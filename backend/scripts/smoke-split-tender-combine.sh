#!/usr/bin/env bash
# REV 2.5 smoke test: Split Tender + Combine Tables
# Skenario sesuai spec: docs/superpowers/specs/2026-05-26-split-tender-combine-design.md
set -u

BASE=http://localhost:8000/api
JQ() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);$1}catch(e){console.error('parse fail:',d.slice(0,200))}})"; }

OWNER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | JQ 'console.log(j.data.token)')
JASON_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | JQ 'console.log(j.data.token)')

echo "Tokens: OWNER=${OWNER_TOKEN:0:20}... JASON=${JASON_TOKEN:0:20}..."

# Cari/buka shift malam Jason
SHIFTS=$(curl -s "$BASE/shifts/active" -H "Authorization: Bearer $JASON_TOKEN")
SHIFT=$(echo "$SHIFTS" | JQ 'const arr=j.data?.shifts||[];const malam=arr.find(s=>s.type==="malam");console.log(malam?.id||"NONE")')
if [ "$SHIFT" = "NONE" ]; then
  SHIFT=$(curl -s -X POST $BASE/shifts/open -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"type":"malam","openingCash":200000}' | JQ 'console.log(j.data?.shift?.id || "FAIL")')
fi
echo "Using shift: $SHIFT"

AIR_ID=$(curl -s "$BASE/menus?category=Minuman" | JQ 'console.log(j.data.menus.find(m=>m.name==="Air Mineral").id)')
TEH_ID=$(curl -s "$BASE/menus?category=Minuman" | JQ 'console.log(j.data.menus.find(m=>m.name==="Teh Tawar Biasa").id)')
echo "Menus: AIR_ID=$AIR_ID TEH_ID=$TEH_ID"

echo ""
echo "========== COMBINE TABLES + SPLIT TENDER =========="
echo ""

echo "=== 1. Order Meja 3 (10x Air Mineral = 50K subtotal) ==="
TX_A=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"orderType\":\"dineIn\",\"tableNumber\":3,\"items\":[{\"menuId\":$AIR_ID,\"qty\":10}]}")
TX_A_ID=$(echo "$TX_A" | JQ 'console.log(j.data.transaction.id)')
echo "$TX_A" | JQ 'const t=j.data.transaction;console.log("Tx",t.id,"meja",t.tableNumber,"subtotal:",t.subtotal,"status:",t.status,"payments:",t.payments?.length||0)'

echo ""
echo "=== 2. Order Meja 5 (1x Air Mineral = 5K subtotal) ==="
TX_B=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"orderType\":\"dineIn\",\"tableNumber\":5,\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}")
TX_B_ID=$(echo "$TX_B" | JQ 'console.log(j.data.transaction.id)')
echo "$TX_B" | JQ 'const t=j.data.transaction;console.log("Tx",t.id,"meja",t.tableNumber,"subtotal:",t.subtotal)'

echo ""
echo "=== 3. Combine: merge Tx_B → Tx_A (Meja 5 → Meja 3, sources=[B] target=A) ==="
MERGE_BODY="{\"sourceIds\":[$TX_B_ID],\"targetId\":$TX_A_ID}"
curl -s -X POST $BASE/transactions/merge -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$MERGE_BODY" | JQ 'const t=j.data.transaction;console.log("Target after merge: id",t.id,"subtotal:",t.subtotal,"mergedIntoId:",t.mergedIntoId)'

echo ""
echo "=== 4. Verify Tx_B mergedIntoId = Tx_A ==="
curl -s "$BASE/transactions/$TX_B_ID" -H "Authorization: Bearer $JASON_TOKEN" | JQ 'console.log("B mergedIntoId:",j.data.transaction.mergedIntoId,"status:",j.data.transaction.status)'

echo ""
echo "=== 5. addPayment PARTIAL: 30000 cash (sisa harusnya 30500) ==="
ADD1=$(curl -s -X POST "$BASE/transactions/$TX_A_ID/payments" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"method":"cash","amount":30000}')
echo "$ADD1" | JQ 'const t=j.data.transaction;console.log("Status:",t.status,"total:",t.total,"tax:",t.taxAmount,"payments:",t.payments?.map(p=>({method:p.method,amount:p.amount})))'

echo ""
echo "=== 6. addPayment FINAL: 30500 qris → Tx_A status=paid, Tx_B cascade paid ==="
ADD2=$(curl -s -X POST "$BASE/transactions/$TX_A_ID/payments" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"method":"qris","amount":30500}')
echo "$ADD2" | JQ 'const t=j.data.transaction;console.log("Status:",t.status,"paidAt:",t.paidAt?"set":"null","payments:",t.payments?.map(p=>({method:p.method,amount:p.amount})))'

echo ""
echo "=== 7. Verify Tx_B cascade: status=paid, total=0 ==="
curl -s "$BASE/transactions/$TX_B_ID" -H "Authorization: Bearer $JASON_TOKEN" | JQ 'const t=j.data.transaction;console.log("B status:",t.status,"total:",t.total,"paidAt:",t.paidAt?"set":"null")'

echo ""
echo "=== 8. Reject overpay: addPayment edc 10000 BCA → 400 (sudah lunas) ==="
curl -s -X POST "$BASE/transactions/$TX_A_ID/payments" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"method":"edc","amount":10000,"bank":"BCA"}' | head -c 250; echo

echo ""
echo "=== 9. Reject removePayment after paid: DELETE /payments/1 → 400 ==="
P_ID=$(echo "$ADD2" | JQ 'console.log(j.data.transaction.payments[0].id)')
curl -s -X DELETE "$BASE/transactions/$TX_A_ID/payments/$P_ID" -H "Authorization: Bearer $JASON_TOKEN" | head -c 250; echo

echo ""
echo "=== 10. Settlement preview untuk shift Jason → cash 30K + qris 30.5K = 60.5K ==="
curl -s "$BASE/settlements/preview?shiftId=$SHIFT" -H "Authorization: Bearer $JASON_TOKEN" | JQ 'const p=j.data.preview;console.log("System totals:",p.system,"totalSystem:",p.totalSystem,"bankBreakdown:",p.bankBreakdown)'

echo ""
echo "=== 11. Dashboard owner today byMethod cash + qris ==="
curl -s "$BASE/dashboard/owner?period=today" -H "Authorization: Bearer $OWNER_TOKEN" | JQ 'const r=j.data.report.revenue;console.log("Revenue total:",r.total,"txCount:",r.transactionCount,"byMethod:",r.byMethod,"bankBreakdown:",r.bankBreakdown)'

echo ""
echo "========== VALIDATION SPLIT TENDER VARIANS =========="
echo ""

echo "=== 12. Buat Tx baru meja 6 (2x Teh = 10K subtotal) untuk skenario discount + split ==="
TX_C=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"orderType\":\"dineIn\",\"tableNumber\":6,\"items\":[{\"menuId\":$TEH_ID,\"qty\":2}]}")
TX_C_ID=$(echo "$TX_C" | JQ 'console.log(j.data.transaction.id)')
echo "$TX_C" | JQ 'const t=j.data.transaction;console.log("Tx",t.id,"subtotal:",t.subtotal)'

echo ""
echo "=== 13. addPayment first slice dengan discount 2000 → recompute PB1 dari (subtotal-disc) ==="
curl -s -X POST "$BASE/transactions/$TX_C_ID/payments" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"method":"cash","amount":3000,"discountAmount":2000}' | JQ 'const t=j.data.transaction;console.log("After first slice: subtotal:",t.subtotal,"disc:",t.discountAmount,"tax:",t.taxAmount,"total:",t.total,"status:",t.status)'

echo ""
echo "=== 14. Reject discount di slice ke-2 → 400 ==="
curl -s -X POST "$BASE/transactions/$TX_C_ID/payments" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"method":"qris","amount":5800,"discountAmount":1000}' | head -c 250; echo

echo ""
echo "=== 15. addPayment slice ke-2 tanpa discount, amount cocok dengan sisa → Tx paid ==="
# Subtotal 10K - disc 2K = 8K; PB1 800; total 8800. Slice 1: 3000. Sisa = 5800.
curl -s -X POST "$BASE/transactions/$TX_C_ID/payments" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"method":"qris","amount":5800}' | JQ 'const t=j.data.transaction;console.log("Tx_C final: status:",t.status,"total:",t.total,"sum payments:",t.payments.reduce((s,p)=>s+p.amount,0))'

echo ""
echo "=== 16. Validasi bank wajib EDC: addPayment edc tanpa bank → 422 ==="
TX_D=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"orderType\":\"dineIn\",\"tableNumber\":7,\"items\":[{\"menuId\":$TEH_ID,\"qty\":1}]}" | JQ 'console.log(j.data.transaction.id)')
curl -s -X POST "$BASE/transactions/$TX_D/payments" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"method":"edc","amount":5500}' | head -c 250; echo

echo ""
echo "=== 17. Validasi: addPayment edc dengan bank BCA → OK ==="
curl -s -X POST "$BASE/transactions/$TX_D/payments" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"method":"edc","amount":5500,"bank":"BCA"}' | JQ 'const t=j.data.transaction;console.log("Tx_D paid via edc BCA: status:",t.status,"payments[0]:",t.payments[0])'

echo ""
echo "=== 18. Bank breakdown di dashboard owner today → harus include EDC BCA 5.5K ==="
curl -s "$BASE/dashboard/owner?period=today" -H "Authorization: Bearer $OWNER_TOKEN" | JQ 'console.log("Bank breakdown:",j.data.report.revenue.bankBreakdown)'

echo ""
echo "=== 19. Validasi: combine cross-shift → 400 (Jason vs shift owner kalau ada) ==="
echo "(skipped if no second shift)"

echo ""
echo "=== 20. Validasi: combine sudah merged → 400 ==="
TX_E=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"orderType\":\"dineIn\",\"tableNumber\":8,\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}" | JQ 'console.log(j.data.transaction.id)')
TX_F=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"orderType\":\"dineIn\",\"tableNumber\":9,\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}" | JQ 'console.log(j.data.transaction.id)')
curl -s -X POST $BASE/transactions/merge -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"sourceIds\":[$TX_E],\"targetId\":$TX_F}" > /dev/null
# Coba merge ulang Tx_E → 400 karena sudah merged
curl -s -X POST $BASE/transactions/merge -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"sourceIds\":[$TX_E],\"targetId\":$TX_F}" | head -c 250; echo

echo ""
echo "========== SMOKE TEST SELESAI =========="
