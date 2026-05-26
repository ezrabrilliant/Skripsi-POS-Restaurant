#!/usr/bin/env bash
# Phase 5 smoke test: stocks/portion ops
set -u

BASE=http://localhost:8000/api

jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,300))}})"
}

# Login 3 users (semua boleh akses stok porsi per matrix REV 2.3)
OWNER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq_field 'console.log(j.data.token)')
JASON_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | jq_field 'console.log(j.data.token)')
AMEL_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Amel","pin":"222222"}' | jq_field 'console.log(j.data.token)')

echo ""
echo "=== 1. GET /stocks/portion tanpa auth → 401 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/stocks/portion

echo ""
echo "=== 2. GET /stocks/portion (Amel waiter) → 200 + auto-snapshot triggered ==="
RESP=$(curl -s $BASE/stocks/portion -H "Authorization: Bearer $AMEL_TOKEN")
TOTAL=$(echo "$RESP" | jq_field 'console.log(j.data.stocks.length)')
TODAY=$(date +%Y-%m-%d)
SNAPSHOT_DATES=$(echo "$RESP" | jq_field 'const dates = [...new Set(j.data.stocks.map(s=>s.openingQtyDate))]; console.log(dates.join(","))')
echo "Total stocks: $TOTAL"
echo "openingQtyDate distinct: $SNAPSHOT_DATES (expected today=$TODAY)"

echo ""
echo "=== 3. GET /stocks/portion?lowStock=true (kasir Jason) → filter currentQty <= minStock ==="
LOW=$(curl -s "$BASE/stocks/portion?lowStock=true" -H "Authorization: Bearer $JASON_TOKEN")
echo "$LOW" | jq_field 'console.log("low items:", j.data.stocks.length, "- sample:", j.data.stocks.slice(0,3).map(s=>({name:s.menuName,qty:s.currentQty,min:s.minStock,suggest:s.suggestedRestockMorning})))'

echo ""
echo "=== 4. GET /stocks/portion?category=Signature%20Ayam%20Bakar (owner) ==="
curl -s "$BASE/stocks/portion?category=Signature%20Ayam%20Bakar" -H "Authorization: Bearer $OWNER_TOKEN" \
  | jq_field 'console.log("count:", j.data.stocks.length, "- names:", j.data.stocks.map(s=>s.menuName).slice(0,5))'

echo ""
echo "=== 5. Find Paha Ayam Bakar id + current state ==="
STOCKS=$(curl -s $BASE/stocks/portion -H "Authorization: Bearer $OWNER_TOKEN")
PAHA_BAKAR_ID=$(echo "$STOCKS" | jq_field 'const s=j.data.stocks.find(x=>x.menuName==="Paha Ayam Bakar"); console.log(s.menuId)')
PAHA_BAKAR_QTY_BEFORE=$(echo "$STOCKS" | jq_field 'const s=j.data.stocks.find(x=>x.menuName==="Paha Ayam Bakar"); console.log(s.currentQty)')
PAHA_BAKAR_SUGGEST=$(echo "$STOCKS" | jq_field 'const s=j.data.stocks.find(x=>x.menuName==="Paha Ayam Bakar"); console.log(s.suggestedRestockMorning)')
echo "Paha Bakar id=$PAHA_BAKAR_ID qty=$PAHA_BAKAR_QTY_BEFORE min=10 suggestedRestock=$PAHA_BAKAR_SUGGEST"

ATI_BAKAR_ID=$(echo "$STOCKS" | jq_field 'const s=j.data.stocks.find(x=>x.menuName==="Ati Bakar"); console.log(s.menuId)')

echo ""
echo "=== 6. POST /stocks/portion/restock-morning [{Paha Bakar:15}] (waiter Amel) → 200 ==="
RESTOCK_BODY="{\"items\":[{\"menuId\":$PAHA_BAKAR_ID,\"qty\":15}]}"
curl -s -X POST $BASE/stocks/portion/restock-morning -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" -d "$RESTOCK_BODY" \
  | jq_field 'const s=j.data.stocks[0]; console.log("After restock: qty="+s.currentQty+" suggestedRestock="+s.suggestedRestockMorning+" isLow="+s.isLow)'

echo ""
echo "=== 7. POST restock-morning qty=7 (BUKAN kelipatan 5) → 422 ==="
curl -s -X POST $BASE/stocks/portion/restock-morning -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d "{\"items\":[{\"menuId\":$PAHA_BAKAR_ID,\"qty\":7}]}" | head -c 200; echo

echo ""
echo "=== 8. POST emergency-in {Ati Bakar, 3, 'Gojek 18:30'} (kasir) → 200 ==="
ATI_BEFORE=$(curl -s $BASE/stocks/portion -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const s=j.data.stocks.find(x=>x.menuName==="Ati Bakar"); console.log(s.currentQty)')
EMERG_BODY="{\"menuId\":$ATI_BAKAR_ID,\"qty\":3,\"note\":\"Antar via Gojek 18:30\"}"
curl -s -X POST $BASE/stocks/portion/emergency-in -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$EMERG_BODY" \
  | jq_field 'console.log("Ati Bakar after emergency-in: qty="+j.data.stock.currentQty+" (was '"$ATI_BEFORE"', expected +3)")'

echo ""
echo "=== 9. POST opname [{Paha Bakar:12}] (owner) - selisih akan dihitung ==="
PAHA_NOW=$(curl -s $BASE/stocks/portion -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const s=j.data.stocks.find(x=>x.menuName==="Paha Ayam Bakar"); console.log(s.currentQty)')
echo "Paha Bakar qty sebelum opname: $PAHA_NOW (akan di-set ke 12)"
curl -s -X POST $BASE/stocks/portion/opname -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d "{\"items\":[{\"menuId\":$PAHA_BAKAR_ID,\"qtyFisik\":12}],\"note\":\"Opname pagi\"}" \
  | jq_field 'console.log("After opname: qty="+j.data.stocks[0].currentQty)'

echo ""
echo "=== 10. POST opname [{Paha Bakar:12}] AGAIN - selisih=0, no movement created (idempotent) ==="
MOVE_COUNT_BEFORE=$(curl -s "$BASE/stocks/portion/$PAHA_BAKAR_ID?limit=50" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.stock.recentMovements.length)')
curl -s -X POST $BASE/stocks/portion/opname -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d "{\"items\":[{\"menuId\":$PAHA_BAKAR_ID,\"qtyFisik\":12}]}" \
  | jq_field 'console.log("After opname idempotent: qty="+j.data.stocks[0].currentQty)'
MOVE_COUNT_AFTER=$(curl -s "$BASE/stocks/portion/$PAHA_BAKAR_ID?limit=50" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.stock.recentMovements.length)')
echo "Movements before: $MOVE_COUNT_BEFORE, after idempotent opname: $MOVE_COUNT_AFTER (should be SAME)"

echo ""
echo "=== 11. POST /stocks/portion/:menuId/mark-habis (waiter Amel) → currentQty=0 ==="
curl -s -X POST $BASE/stocks/portion/$PAHA_BAKAR_ID/mark-habis -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" -d '{}' \
  | jq_field 'console.log("After mark-habis: qty="+j.data.stock.currentQty+" isLow="+j.data.stock.isLow)'

echo ""
echo "=== 12. GET /stocks/portion/:menuId dengan recentMovements (last 10) ==="
curl -s "$BASE/stocks/portion/$PAHA_BAKAR_ID?limit=10" -H "Authorization: Bearer $OWNER_TOKEN" \
  | jq_field 'const s=j.data.stock; console.log(JSON.stringify({menu:s.menuName,qty:s.currentQty,recentMovements:s.recentMovements.map(m=>({delta:m.delta,reason:m.reason,note:m.note.slice(0,50)})).slice(0,5)},null,2))'

echo ""
echo "=== 13. POST mark-habis lagi (idempotent - sudah 0) ==="
MOVE_COUNT_BEFORE_2=$(curl -s "$BASE/stocks/portion/$PAHA_BAKAR_ID?limit=50" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.stock.recentMovements.length)')
curl -s -X POST $BASE/stocks/portion/$PAHA_BAKAR_ID/mark-habis -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{}' \
  | jq_field 'console.log("After 2nd mark-habis: qty="+j.data.stock.currentQty)'
MOVE_COUNT_AFTER_2=$(curl -s "$BASE/stocks/portion/$PAHA_BAKAR_ID?limit=50" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.stock.recentMovements.length)')
echo "Movements before: $MOVE_COUNT_BEFORE_2, after idempotent mark-habis: $MOVE_COUNT_AFTER_2 (should be SAME)"

echo ""
echo "=== 14. POST restock-morning batch 3 items (multi-item per call) ==="
BATCH_BODY=$(cat <<EOF
{"items":[
  {"menuId":$PAHA_BAKAR_ID,"qty":15},
  {"menuId":$ATI_BAKAR_ID,"qty":10}
]}
EOF
)
curl -s -X POST $BASE/stocks/portion/restock-morning -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d "$BATCH_BODY" \
  | jq_field 'console.log("Batch restock results:", j.data.stocks.map(s=>({name:s.menuName,qty:s.currentQty})))'

echo ""
echo "=== 15. Validation: emergencyIn dengan menuId invalid → 400 ==="
curl -s -X POST $BASE/stocks/portion/emergency-in -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"menuId":99999,"qty":5}' | head -c 200; echo
