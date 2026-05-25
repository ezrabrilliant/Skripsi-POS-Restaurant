#!/usr/bin/env bash
# Phase 4a smoke test: shifts + transactions full flow
set -u

BASE=http://localhost:8000/api

jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,200))}})"
}

# Login 3 users
OWNER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq_field 'console.log(j.data.token)')
JASON_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | jq_field 'console.log(j.data.token)')
AMEL_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Amel","pin":"222222"}' | jq_field 'console.log(j.data.token)')
echo "Tokens: owner=${OWNER_TOKEN:0:20} kasir=${JASON_TOKEN:0:20} waiter=${AMEL_TOKEN:0:20}"

echo ""
echo "=== 1. Open shift owner (NOT cashier) → expect 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/shifts/open \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"type":"pagi","openingCash":500000}'

echo ""
echo "=== 2. Open shift Jason (kasir) type=pagi openingCash=500000 ==="
SHIFT_RESP=$(curl -s -X POST $BASE/shifts/open \
  -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" \
  -d '{"type":"pagi","openingCash":500000}')
echo "$SHIFT_RESP" | head -c 300; echo
SHIFT_ID=$(echo "$SHIFT_RESP" | jq_field 'console.log(j.data.shift.id)')
echo "Created shift id=$SHIFT_ID"

echo ""
echo "=== 3. Open shift Jason again type=pagi → expect 409 idempotency ==="
curl -s -X POST $BASE/shifts/open \
  -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" \
  -d '{"type":"pagi","openingCash":500000}' | head -c 200; echo

echo ""
echo "=== 4. GET /shifts/active (Jason) ==="
curl -s -X GET $BASE/shifts/active -H "Authorization: Bearer $JASON_TOKEN" \
  | jq_field 'console.log("active shift id:", j.data.shift?.id, "type:", j.data.shift?.type, "cashier:", j.data.shift?.cashierName)'

echo ""
echo "=== 5. GET menu Paket A + Paha Ayam Bakar + Air Mineral ==="
MENUS=$(curl -s "$BASE/menus?includeStock=true")
PAKET_A_ID=$(echo "$MENUS" | jq_field 'console.log(j.data.menus.find(m=>m.name.startsWith("Paket A")).id)')
PAHA_BAKAR_QTY_BEFORE=$(echo "$MENUS" | jq_field 'const m=j.data.menus.find(m=>m.name==="Paha Ayam Bakar"); console.log(m.portionStock.currentQty)')
AIR_MINERAL_ID=$(echo "$MENUS" | jq_field 'console.log(j.data.menus.find(m=>m.name==="Air Mineral").id)')
echo "Paket A id=$PAKET_A_ID, Paha Bakar qty=$PAHA_BAKAR_QTY_BEFORE, Air Mineral id=$AIR_MINERAL_ID"

echo ""
echo "=== 6. Create transaction dineIn tableNumber=3 dengan 1x Paket A (Paha,Bakar,Teh Tawar) ==="
CREATE_BODY=$(cat <<EOF
{"shiftId":$SHIFT_ID,"orderType":"dineIn","tableNumber":3,"items":[{"menuId":$PAKET_A_ID,"qty":1,"subOptionsSelected":{"ayamPart":"Paha","cook":"Bakar","minuman":"Teh Tawar"}}]}
EOF
)
TX_RESP=$(curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "$CREATE_BODY")
echo "$TX_RESP" | head -c 600; echo
TX_ID=$(echo "$TX_RESP" | jq_field 'console.log(j.data.transaction.id)')
echo "Created transaction id=$TX_ID"

echo ""
echo "=== 7. Verify Paha Ayam Bakar PortionStock decremented by 1 ==="
PAHA_BAKAR_QTY_AFTER=$(curl -s "$BASE/menus?includeStock=true" | jq_field 'const m=j.data.menus.find(m=>m.name==="Paha Ayam Bakar"); console.log(m.portionStock.currentQty)')
echo "Paha Bakar qty AFTER order: $PAHA_BAKAR_QTY_AFTER (expected $((PAHA_BAKAR_QTY_BEFORE - 1)))"

echo ""
echo "=== 8. addItems 2x Air Mineral ==="
curl -s -X POST $BASE/transactions/$TX_ID/items \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"items\":[{\"menuId\":$AIR_MINERAL_ID,\"qty\":2}]}" \
  | jq_field 'console.log("after addItems: items=" + j.data.transaction.items.length + " subtotal=" + j.data.transaction.subtotal)'

echo ""
echo "=== 9. Payment EDC bank=BCA discount=0 (subtotal 50k+10k=60k, tax 6k, total 66k) ==="
curl -s -X POST $BASE/transactions/$TX_ID/payment \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"paymentMethod":"edc","paymentBank":"BCA","discountAmount":0}' \
  | jq_field 'console.log(JSON.stringify({status:j.data.transaction.status,paymentMethod:j.data.transaction.paymentMethod,paymentBank:j.data.transaction.paymentBank,subtotal:j.data.transaction.subtotal,discount:j.data.transaction.discountAmount,tax:j.data.transaction.taxAmount,total:j.data.transaction.total}, null, 2))'

echo ""
echo "=== 10. Permission: Amel (waiter) bisa create transaction → expect 201 ==="
CREATE_BODY2=$(cat <<EOF
{"shiftId":$SHIFT_ID,"orderType":"takeaway","items":[{"menuId":$AIR_MINERAL_ID,"qty":1}]}
EOF
)
TX2_RESP=$(curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" \
  -d "$CREATE_BODY2")
echo "$TX2_RESP" | head -c 250; echo
TX2_ID=$(echo "$TX2_RESP" | jq_field 'console.log(j.data.transaction.id)')

echo ""
echo "=== 11. Permission: Amel coba payment → expect 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/transactions/$TX2_ID/payment \
  -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" \
  -d '{"paymentMethod":"cash","discountAmount":0}'

echo ""
echo "=== 12. Validation: dineIn tanpa tableNumber → expect 400 ==="
curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"shiftId\":$SHIFT_ID,\"orderType\":\"dineIn\",\"items\":[{\"menuId\":$AIR_MINERAL_ID,\"qty\":1}]}" \
  | head -c 200; echo

echo ""
echo "=== 13. Validation: takeaway dengan tableNumber → expect 400 ==="
curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"shiftId\":$SHIFT_ID,\"orderType\":\"takeaway\",\"tableNumber\":5,\"items\":[{\"menuId\":$AIR_MINERAL_ID,\"qty\":1}]}" \
  | head -c 200; echo

echo ""
echo "=== 14. Validation: paket A tanpa subOptionsSelected → expect 400 ==="
curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"shiftId\":$SHIFT_ID,\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$PAKET_A_ID,\"qty\":1}]}" \
  | head -c 200; echo

echo ""
echo "=== 15. Validation: paket A pilihan invalid → expect 400 ==="
curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"shiftId\":$SHIFT_ID,\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$PAKET_A_ID,\"qty\":1,\"subOptionsSelected\":{\"ayamPart\":\"Sayap\",\"cook\":\"Bakar\",\"minuman\":\"Teh Tawar\"}}]}" \
  | head -c 250; echo

echo ""
echo "=== 16. Validation: payment edc tanpa paymentBank → expect 422 ==="
TXVAL=$(curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"shiftId\":$SHIFT_ID,\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$AIR_MINERAL_ID,\"qty\":1}]}" \
  | jq_field 'console.log(j.data.transaction.id)')
curl -s -X POST $BASE/transactions/$TXVAL/payment \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"paymentMethod":"edc","discountAmount":0}' | head -c 200; echo

echo ""
echo "=== 17. Validation: payment cash dengan paymentBank → expect 422 ==="
curl -s -X POST $BASE/transactions/$TXVAL/payment \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"paymentMethod":"cash","paymentBank":"BCA","discountAmount":0}' | head -c 200; echo

echo ""
echo "=== 18. Void scenario: create → decrement → void → revert ==="
PAHA_GORENG_QTY_BEFORE=$(curl -s "$BASE/menus?includeStock=true" | jq_field 'const m=j.data.menus.find(m=>m.name==="Paha Ayam Goreng"); console.log(m.portionStock.currentQty)')
PAHA_GORENG_ID=$(curl -s "$BASE/menus?includeStock=true" | jq_field 'const m=j.data.menus.find(m=>m.name==="Paha Ayam Goreng"); console.log(m.id)')
echo "Paha Goreng currentQty BEFORE: $PAHA_GORENG_QTY_BEFORE (id=$PAHA_GORENG_ID)"
TX3=$(curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"shiftId\":$SHIFT_ID,\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$PAHA_GORENG_ID,\"qty\":2}]}" \
  | jq_field 'console.log(j.data.transaction.id)')
PAHA_GORENG_QTY_AFTER_ORDER=$(curl -s "$BASE/menus?includeStock=true" | jq_field 'const m=j.data.menus.find(m=>m.name==="Paha Ayam Goreng"); console.log(m.portionStock.currentQty)')
echo "Tx=$TX3 created (2x Paha Goreng). Qty AFTER order: $PAHA_GORENG_QTY_AFTER_ORDER (expected $((PAHA_GORENG_QTY_BEFORE - 2)))"
curl -s -X POST $BASE/transactions/$TX3/void -H "Authorization: Bearer $OWNER_TOKEN" \
  | jq_field 'console.log("status after void:", j.data.transaction.status)'
PAHA_GORENG_QTY_AFTER_VOID=$(curl -s "$BASE/menus?includeStock=true" | jq_field 'const m=j.data.menus.find(m=>m.name==="Paha Ayam Goreng"); console.log(m.portionStock.currentQty)')
echo "Qty AFTER void: $PAHA_GORENG_QTY_AFTER_VOID (expected back to $PAHA_GORENG_QTY_BEFORE)"

echo ""
echo "=== 19. Close shift Jason ==="
curl -s -X POST $BASE/shifts/$SHIFT_ID/close -H "Authorization: Bearer $JASON_TOKEN" \
  | jq_field 'console.log("shift closed at:", j.data.shift.closedAt)'

echo ""
echo "=== 20. Create transaction pada shift yang sudah closed → expect 400 ==="
curl -s -X POST $BASE/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"shiftId\":$SHIFT_ID,\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$AIR_MINERAL_ID,\"qty\":1}]}" \
  | head -c 200; echo
