#!/usr/bin/env bash
# Phase 7 smoke test: vendors + purchases (dengan auto-effect ke raw_materials + audit log)
set -u

BASE=http://localhost:8000/api

jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,300))}})"
}

OWNER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq_field 'console.log(j.data.token)')
JASON_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | jq_field 'console.log(j.data.token)')
AMEL_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Amel","pin":"222222"}' | jq_field 'console.log(j.data.token)')

echo ""
echo "========== VENDORS =========="
echo ""
echo "=== 1. GET /vendors (Amel waiter) → 403 (waiter ✗ per matrix) ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/vendors -H "Authorization: Bearer $AMEL_TOKEN"

echo ""
echo "=== 2. GET /vendors (Jason kasir) → 200 + 3 items (seed: Pasar Pagi, Bu Sari, Toko Pak Budi) ==="
curl -s $BASE/vendors -H "Authorization: Bearer $JASON_TOKEN" | jq_field 'console.log("count:", j.data.vendors.length, "— sample:", j.data.vendors.slice(0,3).map(v=>({name:v.name, type:v.type, phone:v.phone, purchaseCount:v.purchaseCount})))'

echo ""
echo "=== 3. POST create (kasir Jason) → 201 ==="
CREATE=$(curl -s -X POST $BASE/vendors -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"name":"Toko Sayur Maju","type":"toko","phone":"08123456789","note":"Toko sayur dekat pasar"}')
echo "$CREATE" | head -c 300; echo
NEW_VENDOR_ID=$(echo "$CREATE" | jq_field 'console.log(j.data.vendor.id)')

echo ""
echo "=== 4. POST duplicate name → 409 ==="
curl -s -X POST $BASE/vendors -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"name":"Toko Sayur Maju","type":"toko"}' | head -c 200; echo

echo ""
echo "=== 5. PUT update (owner) — ubah phone + note jadi null ==="
curl -s -X PUT $BASE/vendors/$NEW_VENDOR_ID -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"phone":null,"note":"Pindah ke kios depan"}' | jq_field 'console.log(JSON.stringify({name:j.data.vendor.name,phone:j.data.vendor.phone,note:j.data.vendor.note},null,2))'

echo ""
echo "========== PURCHASES =========="
echo ""
echo "=== 6. POST /purchases (waiter Amel) → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/purchases -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" -d '{"date":"2026-05-24","items":[]}'

echo ""
echo "=== 7. Capture pre-purchase state of Tahu (tracked) + Cabai Rawit (NOT tracked) ==="
RM_BEFORE=$(curl -s $BASE/stocks/raw-materials -H "Authorization: Bearer $OWNER_TOKEN")
TAHU=$(echo "$RM_BEFORE" | jq_field 'const r=j.data.rawMaterials.find(x=>x.name==="Tahu"); console.log(JSON.stringify({id:r.id,qty:r.stockQty,lastBuyDate:r.lastBuyDate,unitPrice:r.unitPrice}))')
CABAI=$(echo "$RM_BEFORE" | jq_field 'const r=j.data.rawMaterials.find(x=>x.name==="Cabai Rawit"); console.log(JSON.stringify({id:r.id,qty:r.stockQty,lastBuyDate:r.lastBuyDate,unitPrice:r.unitPrice,isTracked:r.isTracked}))')
echo "Tahu BEFORE: $TAHU"
echo "Cabai Rawit BEFORE: $CABAI"
TAHU_ID=$(echo "$TAHU" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")
CABAI_ID=$(echo "$CABAI" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).id))")

echo ""
echo "=== 8. POST /purchases (kasir Jason) — 3 balok Tahu + 200 gram Cabai Rawit ==="
PURCHASE_BODY=$(cat <<EOF
{
  "date":"2026-05-24",
  "vendorId":$NEW_VENDOR_ID,
  "note":"Belanja pagi pasar",
  "items":[
    {"rawMaterialId":$TAHU_ID,"qty":3,"unitPrice":5000},
    {"rawMaterialId":$CABAI_ID,"qty":200,"unitPrice":150,"expiredDate":"2026-05-31"}
  ]
}
EOF
)
P_RESP=$(curl -s -X POST $BASE/purchases -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$PURCHASE_BODY")
echo "$P_RESP" | head -c 700; echo
PURCHASE_ID=$(echo "$P_RESP" | jq_field 'console.log(j.data.purchase.id)')
echo "Purchase id=$PURCHASE_ID"

echo ""
echo "=== 9. Verify auto-effect: Tahu (tracked) stockQty += 3, lastBuyDate=today, unitPrice=5000 ==="
curl -s $BASE/stocks/raw-materials/$TAHU_ID -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const r=j.data.rawMaterial; console.log(JSON.stringify({name:r.name,qty:r.stockQty,lastBuyDate:r.lastBuyDate,unitPrice:r.unitPrice,recentMovements:r.recentMovements.slice(0,2).map(m=>({delta:m.delta,reason:m.reason,note:m.note.slice(0,80)}))},null,2))'

echo ""
echo "=== 10. Verify auto-effect: Cabai Rawit (NOT tracked) stockQty UNCHANGED, but lastBuyDate=today, unitPrice=150, audit log inserted ==="
curl -s $BASE/stocks/raw-materials/$CABAI_ID -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const r=j.data.rawMaterial; console.log(JSON.stringify({name:r.name,isTracked:r.isTracked,qty:r.stockQty,lastBuyDate:r.lastBuyDate,unitPrice:r.unitPrice,recentMovements:r.recentMovements.slice(0,2).map(m=>({delta:m.delta,reason:m.reason,note:m.note.slice(0,90)}))},null,2))'

echo ""
echo "=== 11. GET /purchases/:id detail ==="
curl -s $BASE/purchases/$PURCHASE_ID -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const p=j.data.purchase; console.log(JSON.stringify({id:p.id,date:p.date,vendor:p.vendorName,totalAmount:p.totalAmount,note:p.note,itemCount:p.items.length,items:p.items.map(i=>({name:i.rawMaterialName,unit:i.rawMaterialUnit,tracked:i.isTracked,qty:i.qty,unitPrice:i.unitPrice,subtotal:i.subtotal,expiredDate:i.expiredDate}))},null,2))'

echo ""
echo "=== 12. POST /purchases tanpa vendorId (opsional) → 201 ==="
NO_VENDOR_BODY=$(cat <<EOF
{
  "date":"2026-05-24",
  "note":"Belanja tanpa vendor (kasir lupa nama)",
  "items":[{"rawMaterialId":$CABAI_ID,"qty":50,"unitPrice":160}]
}
EOF
)
curl -s -X POST $BASE/purchases -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d "$NO_VENDOR_BODY" | jq_field 'console.log("Without vendor: id=" + j.data.purchase.id + " vendor=" + j.data.purchase.vendorName + " total=" + j.data.purchase.totalAmount)'

echo ""
echo "=== 13. Validation: POST /purchases dengan rawMaterialId invalid → 400 ==="
curl -s -X POST $BASE/purchases -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"date":"2026-05-24","items":[{"rawMaterialId":99999,"qty":1,"unitPrice":100}]}' | head -c 250; echo

echo ""
echo "=== 14. Validation: POST /purchases tanpa items → 422 ==="
curl -s -X POST $BASE/purchases -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"date":"2026-05-24","items":[]}' | head -c 250; echo

echo ""
echo "=== 15. Validation: POST /purchases vendorId invalid → 400 ==="
curl -s -X POST $BASE/purchases -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d "{\"date\":\"2026-05-24\",\"vendorId\":99999,\"items\":[{\"rawMaterialId\":$TAHU_ID,\"qty\":1,\"unitPrice\":5000}]}" | head -c 250; echo

echo ""
echo "=== 16. GET /purchases?date=2026-05-24 filter ==="
curl -s "$BASE/purchases?date=2026-05-24" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log("today total:", j.data.purchases.length, "— totals:", j.data.purchases.map(p=>({id:p.id,total:p.totalAmount,vendor:p.vendorName})))'

echo ""
echo "=== 17. GET /purchases?month=2026-05 filter ==="
curl -s "$BASE/purchases?month=2026-05" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log("May 2026 total:", j.data.purchases.length)'

echo ""
echo "=== 18. GET /vendors (now Toko Sayur Maju punya 1 purchase reference) ==="
curl -s $BASE/vendors -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const v=j.data.vendors.find(x=>x.name==="Toko Sayur Maju"); console.log("Toko Sayur Maju purchaseCount:", v?.purchaseCount)'

echo ""
echo "=== 19. DELETE vendor yang sudah dipakai → 409 (FK protection) ==="
curl -s -X DELETE $BASE/vendors/$NEW_VENDOR_ID -H "Authorization: Bearer $OWNER_TOKEN" | head -c 250; echo

echo ""
echo "=== 20. DELETE vendor yang belum dipakai (Bu Sari biasa, seed default) ==="
BU_SARI_ID=$(curl -s $BASE/vendors -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const v=j.data.vendors.find(x=>x.name==="Bu Sari"); console.log(v.id)')
curl -s -X DELETE $BASE/vendors/$BU_SARI_ID -H "Authorization: Bearer $OWNER_TOKEN" | head -c 250; echo
