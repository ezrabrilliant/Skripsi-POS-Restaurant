#!/usr/bin/env bash
# Phase 8 smoke test: bills + settlements (dengan full settlement flow)
set -u

BASE=http://localhost:8000/api

jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,300))}})"
}

OWNER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq_field 'console.log(j.data.token)')
JASON_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | jq_field 'console.log(j.data.token)')
BRYANT_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Bryant","pin":"111111"}' | jq_field 'console.log(j.data.token)')
AMEL_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Amel","pin":"222222"}' | jq_field 'console.log(j.data.token)')

echo ""
echo "========== BILLS =========="
echo ""
echo "=== 1. POST /bills (Jason kasir) → 403 (owner only) ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/bills -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"month":"2026-05","category":"listrik","amount":500000}'

echo ""
echo "=== 2. POST /bills (Amel waiter) → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/bills -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" -d '{"month":"2026-05","category":"listrik","amount":500000}'

echo ""
echo "=== 3. POST /bills (owner) → 201 ==="
B1=$(curl -s -X POST $BASE/bills -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"month":"2026-05","category":"listrik","amount":520000,"note":"PLN April-Mei"}')
echo "$B1" | head -c 300; echo
BILL_ID=$(echo "$B1" | jq_field 'console.log(j.data.bill.id)')

echo ""
echo "=== 4. POST /bills multi categories ==="
for cat in kebersihan air parkir sewa; do
  curl -s -X POST $BASE/bills -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d "{\"month\":\"2026-05\",\"category\":\"$cat\",\"amount\":100000}" > /dev/null
done
echo "Inserted 4 more bills (kebersihan/air/parkir/sewa)"

echo ""
echo "=== 5. POST invalid month format → 422 ==="
curl -s -X POST $BASE/bills -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"month":"May-2026","category":"listrik","amount":500000}' | head -c 200; echo

echo ""
echo "=== 6. POST invalid category → 422 ==="
curl -s -X POST $BASE/bills -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"month":"2026-05","category":"internet","amount":500000}' | head -c 200; echo

echo ""
echo "=== 7. GET /bills filter ?month=2026-05 ==="
curl -s "$BASE/bills?month=2026-05" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log("count:", j.data.bills.length, "total:", j.data.bills.reduce((s,b)=>s+b.amount,0))'

echo ""
echo "=== 8. GET /bills filter ?category=listrik ==="
curl -s "$BASE/bills?category=listrik" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log("listrik bills:", j.data.bills.map(b=>({month:b.month,amount:b.amount,note:b.note})))'

echo ""
echo "=== 9. PUT /bills/:id ubah amount ==="
curl -s -X PUT $BASE/bills/$BILL_ID -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"amount":480000}' | jq_field 'console.log("After PUT: amount=" + j.data.bill.amount)'

echo ""
echo "=== 10. DELETE /bills/:id ==="
curl -s -X DELETE $BASE/bills/$BILL_ID -H "Authorization: Bearer $OWNER_TOKEN" | head -c 200; echo

echo ""
echo "========== SETTLEMENTS =========="
echo ""
echo "=== 11. Buka shift MALAM (atau reuse kalau sudah ada) ==="
# REV 2.3 shift-decoupling: cek dulu /shifts/active (array). Kalau ada malam aktif, reuse.
ACTIVE_SHIFTS=$(curl -s "$BASE/shifts/active" -H "Authorization: Bearer $BRYANT_TOKEN")
MALAM_SHIFT_ID=$(echo "$ACTIVE_SHIFTS" | jq_field 'const arr=j.data?.shifts||[];const m=arr.find(s=>s.type==="malam");console.log(m?.id||"")')
if [ -z "$MALAM_SHIFT_ID" ]; then
  SHIFT_RESP=$(curl -s -X POST $BASE/shifts/open -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d '{"type":"malam","openingCash":300000}')
  MALAM_SHIFT_ID=$(echo "$SHIFT_RESP" | jq_field 'console.log(j.data?.shift?.id||"")')
  echo "Opened new malam shift: $MALAM_SHIFT_ID"
else
  echo "Reusing active malam shift: $MALAM_SHIFT_ID"
fi
if [ -z "$MALAM_SHIFT_ID" ]; then
  echo "ERROR: gagal dapat malam shift id. Server log + DB state perlu diperiksa. Exit."
  exit 1
fi
# Cek owner shift dari relasi (mungkin Jason, bukan Bryant - settle gating tetap perlu match)
MALAM_CASHIER=$(curl -s "$BASE/shifts/$MALAM_SHIFT_ID" -H "Authorization: Bearer $BRYANT_TOKEN" | jq_field 'console.log(j.data.shift.cashierName)')
echo "Malam shift cashier = $MALAM_CASHIER (id=$MALAM_SHIFT_ID)"

echo ""
echo "=== 12. Buat & bayar 6 transaksi dengan beragam payment method ==="
AIR_MINERAL_ID=$(curl -s "$BASE/menus?category=Minuman" | jq_field 'console.log(j.data.menus.find(m=>m.name==="Air Mineral").id)')
TEH_TAWAR_ID=$(curl -s "$BASE/menus?category=Minuman" | jq_field 'console.log(j.data.menus.find(m=>m.name==="Teh Tawar Biasa").id)')

create_and_pay() {
  local method=$1
  local bank=$2
  local qty=$3
  # REV 2.3 shift-decoupling: shiftId tidak di-input, backend auto-resolve dari active shift.
  local body="{\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$AIR_MINERAL_ID,\"qty\":$qty}]}"
  local tx_resp=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d "$body")
  local tx_id=$(echo "$tx_resp" | jq_field 'console.log(j.data.transaction.id)')
  local tx_total=$(echo "$tx_resp" | jq_field 'console.log(j.data.transaction.total)')
  # REV 2.5: split tender endpoint - POST /:id/payments + amount wajib.
  # PB1 10% di-auto-compute saat first payment (discountAmount first slice).
  # Tax = subtotal * 0.1, jadi total = subtotal * 1.1 = qty*5000*1.1.
  local total_with_tax=$(node -e "console.log(${qty}*5000*1.1)")
  local pay_body
  if [ -n "$bank" ]; then
    pay_body="{\"method\":\"$method\",\"bank\":\"$bank\",\"amount\":$total_with_tax,\"discountAmount\":0}"
  else
    pay_body="{\"method\":\"$method\",\"amount\":$total_with_tax,\"discountAmount\":0}"
  fi
  local total=$(curl -s -X POST $BASE/transactions/$tx_id/payments -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d "$pay_body" | jq_field 'console.log(j.data.transaction.total)')
  echo "  tx=$tx_id method=$method bank=${bank:--} qty=$qty (5000 each) → total=$total"
}

create_and_pay cash "" 1        # 5500 (5000 + 10% tax)
create_and_pay edc BCA 2        # 11000
create_and_pay edc Mandiri 3    # 16500
create_and_pay qris "" 1        # 5500
create_and_pay gojek "" 2       # 11000
create_and_pay grab "" 1        # 5500
create_and_pay transfer BCA 4   # 22000

echo ""
echo "=== 13. Tutup shift malam ($MALAM_CASHIER) ==="
# Owner forcedly closes (allowed) untuk konsisten siapapun cashier-nya
curl -s -X POST $BASE/shifts/$MALAM_SHIFT_ID/close -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log("shift closed:", j.data.shift.closedAt)'

echo ""
echo "=== 14. GET /settlements/preview?shiftId=X - REV 2.6 system: array ==="
curl -s "$BASE/settlements/preview?shiftId=$MALAM_SHIFT_ID" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const p=j.data.preview; console.log(JSON.stringify({shiftId:p.shiftId,shiftType:p.shiftType,cashier:p.cashierName,system:p.system,totalSystem:p.totalSystem,bankBreakdown:p.bankBreakdown,existingSettlementId:p.existingSettlementId},null,2))'

echo ""
echo "=== 15. POST submit (kasir lain coba settle shift $MALAM_CASHIER) → 403 - REV 2.6 counts: {} ==="
# REV 2.6: counts dinamis, bukan 6 field actualXxx fixed.
# System totals (sesuai step 12): cash=5500, edc=27500, qris=5500, gojek=11000, grab=5500, transfer=22000.
SUBMIT_BODY="{\"shiftId\":$MALAM_SHIFT_ID,\"counts\":{\"cash\":5500,\"edc\":27500,\"qris\":5500,\"gojek\":11000,\"grab\":5500,\"transfer\":22000}}"
# Pilih token kasir yang BUKAN owner shift (kalau Jason cashier → pakai Bryant token, vice versa)
if [ "$MALAM_CASHIER" = "Jason" ]; then
  OTHER_KASIR_TOKEN=$BRYANT_TOKEN
  OWN_KASIR_TOKEN=$JASON_TOKEN
else
  OTHER_KASIR_TOKEN=$JASON_TOKEN
  OWN_KASIR_TOKEN=$BRYANT_TOKEN
fi
curl -s -o /dev/null -w "status=%{http_code} " -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $OTHER_KASIR_TOKEN" -d "$SUBMIT_BODY"
curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $OTHER_KASIR_TOKEN" -d "$SUBMIT_BODY" | head -c 200; echo

echo ""
echo "=== 16. POST submit (kasir owner shift malam-nya sendiri) → 201 ==="
SETTLE_RESP=$(curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $OWN_KASIR_TOKEN" -d "$SUBMIT_BODY")
echo "$SETTLE_RESP" | head -c 500; echo
SETTLE_ID=$(echo "$SETTLE_RESP" | jq_field 'console.log(j.data.settlement.id)')
echo "Settlement id=$SETTLE_ID"

echo ""
echo "=== 17. POST submit lagi (duplicate) → 409 UNIQUE ==="
curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $OWN_KASIR_TOKEN" -d "$SUBMIT_BODY" | head -c 200; echo

echo ""
echo "=== 18. GET /settlements/:id verify variance (counted=system semua → variance=0) - REV 2.6 methodCounts: [] ==="
curl -s "$BASE/settlements/$SETTLE_ID" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const s=j.data.settlement; console.log(JSON.stringify({status:s.status,methodCounts:s.methodCounts,totalCounted:s.totalCounted,totalSystem:s.totalSystem,totalVariance:s.totalVariance,bankBreakdown:s.bankBreakdown},null,2))'

echo ""
echo "=== 19. PUT /:id/review (kasir) → 403 (owner-only) ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X PUT $BASE/settlements/$SETTLE_ID/review -H "Authorization: Bearer $OWN_KASIR_TOKEN"

echo ""
echo "=== 20. PUT /:id/review (owner) → 200 status=reviewed ==="
curl -s -X PUT $BASE/settlements/$SETTLE_ID/review -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const s=j.data.settlement; console.log(JSON.stringify({status:s.status,reviewerName:s.reviewerName,reviewedAt:s.reviewedAt?.slice(0,19)},null,2))'

echo ""
echo "=== 21. PUT /:id/review again → 400 already reviewed ==="
curl -s -X PUT $BASE/settlements/$SETTLE_ID/review -H "Authorization: Bearer $OWNER_TOKEN" | head -c 200; echo

echo ""
echo "=== 22. POST submit settlement untuk shift PAGI Jason oleh Bryant → 403 (cashier-malam-only constraint) ==="
# Reuse active pagi shift kalau ada; otherwise open baru
ACTIVE_AFTER_22=$(curl -s "$BASE/shifts/active" -H "Authorization: Bearer $JASON_TOKEN")
JASON_PAGI=$(echo "$ACTIVE_AFTER_22" | jq_field 'const arr=j.data?.shifts||[];const p=arr.find(s=>s.type==="pagi"&&s.cashierName==="Jason");console.log(p?.id||"")')
if [ -z "$JASON_PAGI" ]; then
  JASON_PAGI=$(curl -s -X POST $BASE/shifts/open -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"type":"pagi","openingCash":500000}' | jq_field 'console.log(j.data?.shift?.id||"")')
  echo "Opened Jason pagi shift: $JASON_PAGI"
fi
echo "Jason pagi shift id: $JASON_PAGI"
if [ -n "$JASON_PAGI" ]; then
  curl -s -X POST $BASE/shifts/$JASON_PAGI/close -H "Authorization: Bearer $JASON_TOKEN" > /dev/null
  # Bryant coba settle Jason's pagi shift - REV 2.6 counts dinamis (kosong = no transactions)
  BAD_BODY="{\"shiftId\":$JASON_PAGI,\"counts\":{}}"
  curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d "$BAD_BODY" | head -c 250; echo
  echo "(Bryant ↑ tidak own Jason's pagi shift)"
  # Jason settles own pagi shift → 403 because not malam
  curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$BAD_BODY" | head -c 250; echo
  echo "(Jason ↑ own shift tapi pagi, bukan malam → 403)"
  # Owner settles Jason's pagi shift → OK because owner bypass kasir-malam constraint
  curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d "$BAD_BODY" | jq_field 'console.log("Owner settle Jason pagi:", j.data.settlement?.id ? "OK id=" + j.data.settlement.id : j.message)'
fi

echo ""
echo "=== 23. GET /settlements list filter ==="
curl -s "$BASE/settlements?month=2026-05" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log("settlements May 2026:", j.data.settlements.map(s=>({id:s.id,date:s.date,cashier:s.cashierName,status:s.status,totalSystem:s.totalSystem})))'
