#!/usr/bin/env bash
# Phase 4b smoke test: split + merge bill
set -u

BASE=http://localhost:8000/api
JQ() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);$1}catch(e){console.error('parse fail:',d.slice(0,200))}})"; }

OWNER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | JQ 'console.log(j.data.token)')
JASON_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | JQ 'console.log(j.data.token)')

# Cari shift Jason yang masih open (atau buka baru kalau perlu)
SHIFT=$(curl -s "$BASE/shifts/active" -H "Authorization: Bearer $JASON_TOKEN" | JQ 'console.log(j.data?.shift?.id || "NONE")')
if [ "$SHIFT" = "NONE" ]; then
  # Buka shift baru — try malam kalau pagi sudah ada
  SHIFT=$(curl -s -X POST $BASE/shifts/open -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"type":"malam","openingCash":500000}' | JQ 'console.log(j.data?.shift?.id || "FAIL")')
fi
echo "Using shift: $SHIFT"

AIR_ID=$(curl -s "$BASE/menus?category=Minuman" | JQ 'console.log(j.data.menus.find(m=>m.name==="Air Mineral").id)')
TEH_ID=$(curl -s "$BASE/menus?category=Minuman" | JQ 'console.log(j.data.menus.find(m=>m.name==="Teh Tawar Biasa").id)')

echo ""
echo "========== SPLIT BILL =========="
echo ""
echo "=== 1. Create tx dengan 4 items (2x Air, 2x Teh) ==="
TX1=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"shiftId\":$SHIFT,\"orderType\":\"dineIn\",\"tableNumber\":1,\"items\":[{\"menuId\":$AIR_ID,\"qty\":1},{\"menuId\":$AIR_ID,\"qty\":1},{\"menuId\":$TEH_ID,\"qty\":1},{\"menuId\":$TEH_ID,\"qty\":1}]}")
TX1_ID=$(echo "$TX1" | JQ 'console.log(j.data.transaction.id)')
echo "$TX1" | JQ 'const tx=j.data.transaction;console.log("Tx",tx.id,"items:",tx.items.map(it=>({id:it.id,name:it.menuName,party:it.partyId})))'
ITEM_IDS=$(echo "$TX1" | JQ 'console.log(j.data.transaction.items.map(it=>it.id).join(","))')
ITEM_ARR=($(echo $ITEM_IDS | tr ',' ' '))

echo ""
echo "=== 2. PUT /split — assign party 1 to items 0+1, party 2 to items 2+3 ==="
SPLIT_BODY="{\"assignments\":[{\"itemId\":${ITEM_ARR[0]},\"partyId\":1},{\"itemId\":${ITEM_ARR[1]},\"partyId\":1},{\"itemId\":${ITEM_ARR[2]},\"partyId\":2},{\"itemId\":${ITEM_ARR[3]},\"partyId\":2}]}"
curl -s -X PUT "$BASE/transactions/$TX1_ID/split" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$SPLIT_BODY" | JQ 'const tx=j.data.transaction;console.log("After split:");tx.items.forEach(it=>console.log("  item",it.id,it.menuName,"party",it.partyId))'

echo ""
echo "=== 3. Validation: split partyId itemId invalid → 400 ==="
curl -s -X PUT "$BASE/transactions/$TX1_ID/split" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"assignments":[{"itemId":99999,"partyId":1}]}' | head -c 200; echo

echo ""
echo "========== MERGE BILL =========="
echo ""
echo "=== 4. Buat 3 tx dineIn (table 2, 3, 4) ==="
TX_A=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"shiftId\":$SHIFT,\"orderType\":\"dineIn\",\"tableNumber\":2,\"items\":[{\"menuId\":$AIR_ID,\"qty\":2}]}" | JQ 'console.log(j.data.transaction.id)')
TX_B=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"shiftId\":$SHIFT,\"orderType\":\"dineIn\",\"tableNumber\":3,\"items\":[{\"menuId\":$AIR_ID,\"qty\":3}]}" | JQ 'console.log(j.data.transaction.id)')
TX_C=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"shiftId\":$SHIFT,\"orderType\":\"dineIn\",\"tableNumber\":4,\"items\":[{\"menuId\":$AIR_ID,\"qty\":4}]}" | JQ 'console.log(j.data.transaction.id)')
echo "Created: A=$TX_A (2x Air=10K) B=$TX_B (3x Air=15K) C=$TX_C (4x Air=20K)"

echo ""
echo "=== 5. POST /merge sources=[A,B] target=C → C parent, A+B mergedIntoId=C ==="
MERGE_BODY="{\"sourceIds\":[$TX_A,$TX_B],\"targetId\":$TX_C}"
curl -s -X POST $BASE/transactions/merge -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$MERGE_BODY" | JQ 'const tx=j.data.transaction;console.log("Target after merge: id",tx.id,"subtotal:",tx.subtotal,"mergedIntoId:",tx.mergedIntoId)'

echo ""
echo "=== 6. Verify A + B have mergedIntoId=C ==="
curl -s "$BASE/transactions/$TX_A" -H "Authorization: Bearer $JASON_TOKEN" | JQ 'console.log("A mergedIntoId:",j.data.transaction.mergedIntoId)'
curl -s "$BASE/transactions/$TX_B" -H "Authorization: Bearer $JASON_TOKEN" | JQ 'console.log("B mergedIntoId:",j.data.transaction.mergedIntoId)'

echo ""
echo "=== 7. Pay parent C — aggregate total 10K+15K+20K=45K, +PB1 10%=4500 → total 49500 ==="
curl -s -X POST "$BASE/transactions/$TX_C/payment" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"paymentMethod":"cash","discountAmount":0}' | JQ 'const tx=j.data.transaction;console.log("Parent paid: subtotal:",tx.subtotal,"tax:",tx.taxAmount,"total:",tx.total,"status:",tx.status)'

echo ""
echo "=== 8. Verify A + B cascaded to status=paid (total=0 supaya tidak double-count) ==="
curl -s "$BASE/transactions/$TX_A" -H "Authorization: Bearer $JASON_TOKEN" | JQ 'const tx=j.data.transaction;console.log("A: status:",tx.status,"total:",tx.total,"paidAt:",tx.paidAt?"set":"null")'
curl -s "$BASE/transactions/$TX_B" -H "Authorization: Bearer $JASON_TOKEN" | JQ 'const tx=j.data.transaction;console.log("B: status:",tx.status,"total:",tx.total,"paidAt:",tx.paidAt?"set":"null")'

echo ""
echo "=== 9. Validation: pay tx yang sudah mergedIntoId → 400 ==="
TX_D=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"shiftId\":$SHIFT,\"orderType\":\"dineIn\",\"tableNumber\":5,\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}" | JQ 'console.log(j.data.transaction.id)')
TX_E=$(curl -s -X POST $BASE/transactions -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"shiftId\":$SHIFT,\"orderType\":\"dineIn\",\"tableNumber\":6,\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}" | JQ 'console.log(j.data.transaction.id)')
curl -s -X POST $BASE/transactions/merge -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"sourceIds\":[$TX_D],\"targetId\":$TX_E}" > /dev/null
curl -s -X POST "$BASE/transactions/$TX_D/payment" -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"paymentMethod":"cash","discountAmount":0}' | head -c 250; echo

echo ""
echo "=== 10. Validation: merge target sudah closed atau paid → 400 ==="
curl -s -X POST $BASE/transactions/merge -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "{\"sourceIds\":[1],\"targetId\":$TX_C}" | head -c 250; echo