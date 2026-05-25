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
echo "=== 11. Bryant buka shift MALAM ==="
SHIFT_RESP=$(curl -s -X POST $BASE/shifts/open -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d '{"type":"malam","openingCash":300000}')
echo "$SHIFT_RESP" | head -c 200; echo
MALAM_SHIFT_ID=$(echo "$SHIFT_RESP" | jq_field 'console.log(j.data.shift.id)')
echo "Malam shift id=$MALAM_SHIFT_ID"

echo ""
echo "=== 12. Buat & bayar 6 transaksi dengan beragam payment method ==="
AIR_MINERAL_ID=$(curl -s "$BASE/menus?category=Minuman" | jq_field 'console.log(j.data.menus.find(m=>m.name==="Air Mineral").id)')
TEH_TAWAR_ID=$(curl -s "$BASE/menus?category=Minuman" | jq_field 'console.log(j.data.menus.find(m=>m.name==="Teh Tawar Biasa").id)')

create_and_pay() {
  local method=$1
  local bank=$2
  local qty=$3
  local body="{\"shiftId\":$MALAM_SHIFT_ID,\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$AIR_MINERAL_ID,\"qty\":$qty}]}"
  local tx_id=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d "$body" | jq_field 'console.log(j.data.transaction.id)')
  local pay_body
  if [ -n "$bank" ]; then
    pay_body="{\"paymentMethod\":\"$method\",\"paymentBank\":\"$bank\",\"discountAmount\":0}"
  else
    pay_body="{\"paymentMethod\":\"$method\",\"discountAmount\":0}"
  fi
  local total=$(curl -s -X POST $BASE/transactions/$tx_id/payment -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d "$pay_body" | jq_field 'console.log(j.data.transaction.total)')
  echo "  tx=$tx_id method=$method bank=${bank:-—} qty=$qty (5000 each) → total=$total"
}

create_and_pay cash "" 1        # 5500 (5000 + 10% tax)
create_and_pay edc BCA 2        # 11000
create_and_pay edc Mandiri 3    # 16500
create_and_pay qris "" 1        # 5500
create_and_pay gojek "" 2       # 11000
create_and_pay grab "" 1        # 5500
create_and_pay transfer BCA 4   # 22000

echo ""
echo "=== 13. Tutup shift malam Bryant ==="
curl -s -X POST $BASE/shifts/$MALAM_SHIFT_ID/close -H "Authorization: Bearer $BRYANT_TOKEN" | jq_field 'console.log("shift closed:", j.data.shift.closedAt)'

echo ""
echo "=== 14. GET /settlements/preview?shiftId=X (Bryant) ==="
curl -s "$BASE/settlements/preview?shiftId=$MALAM_SHIFT_ID" -H "Authorization: Bearer $BRYANT_TOKEN" | jq_field 'const p=j.data.preview; console.log(JSON.stringify({shiftId:p.shiftId,shiftType:p.shiftType,cashier:p.cashierName,system:p.system,totalSystem:p.totalSystem,bankBreakdown:p.bankBreakdown,existingSettlementId:p.existingSettlementId},null,2))'

echo ""
echo "=== 15. POST submit settlement (Jason coba settle shift Bryant) → 403 ==="
SUBMIT_BODY="{\"shiftId\":$MALAM_SHIFT_ID,\"actualCash\":5500,\"actualEdc\":27500,\"actualQris\":5500,\"actualGojek\":11000,\"actualGrab\":5500,\"actualTransfer\":22000}"
curl -s -o /dev/null -w "status=%{http_code} " -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$SUBMIT_BODY"
curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$SUBMIT_BODY" | head -c 200; echo

echo ""
echo "=== 16. POST submit (Bryant — owner shift malam-nya sendiri) → 201 ==="
SETTLE_RESP=$(curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d "$SUBMIT_BODY")
echo "$SETTLE_RESP" | head -c 500; echo
SETTLE_ID=$(echo "$SETTLE_RESP" | jq_field 'console.log(j.data.settlement.id)')
echo "Settlement id=$SETTLE_ID"

echo ""
echo "=== 17. POST submit lagi (duplicate) → 409 UNIQUE ==="
curl -s -X POST $BASE/settlements -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d "$SUBMIT_BODY" | head -c 200; echo

echo ""
echo "=== 18. GET /settlements/:id verify variance (actual=system semua → variance=0) ==="
curl -s "$BASE/settlements/$SETTLE_ID" -H "Authorization: Bearer $BRYANT_TOKEN" | jq_field 'const s=j.data.settlement; console.log(JSON.stringify({status:s.status,system:s.system,actual:s.actual,variance:s.variance,totalSystem:s.totalSystem,totalActual:s.totalActual,totalVariance:s.totalVariance,bankBreakdown:s.bankBreakdown},null,2))'

echo ""
echo "=== 19. PUT /:id/review (Bryant kasir) → 403 (owner-only) ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X PUT $BASE/settlements/$SETTLE_ID/review -H "Authorization: Bearer $BRYANT_TOKEN"

echo ""
echo "=== 20. PUT /:id/review (owner) → 200 status=reviewed ==="
curl -s -X PUT $BASE/settlements/$SETTLE_ID/review -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const s=j.data.settlement; console.log(JSON.stringify({status:s.status,reviewerName:s.reviewerName,reviewedAt:s.reviewedAt?.slice(0,19)},null,2))'

echo ""
echo "=== 21. PUT /:id/review again → 400 already reviewed ==="
curl -s -X PUT $BASE/settlements/$SETTLE_ID/review -H "Authorization: Bearer $OWNER_TOKEN" | head -c 200; echo

echo ""
echo "=== 22. POST submit settlement untuk shift PAGI Jason oleh Bryant → 403 (cashier-malam-only constraint) ==="
# Open pagi shift Jason
JASON_PAGI=$(curl -s -X POST $BASE/shifts/open -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"type":"pagi","openingCash":500000}' | jq_field 'console.log(j.data.shift?.id || "ALREADY")')
echo "Jason pagi shift id: $JASON_PAGI"
if [ "$JASON_PAGI" != "ALREADY" ]; then
  curl -s -X POST $BASE/shifts/$JASON_PAGI/close -H "Authorization: Bearer $JASON_TOKEN" > /dev/null
  # Bryant coba settle Jason's pagi shift
  BAD_BODY="{\"shiftId\":$JASON_PAGI,\"actualCash\":0,\"actualEdc\":0,\"actualQris\":0,\"actualGojek\":0,\"actualGrab\":0,\"actualTransfer\":0}"
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
