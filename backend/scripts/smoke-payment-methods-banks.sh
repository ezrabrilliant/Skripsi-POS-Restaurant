#!/usr/bin/env bash
# Smoke test REV 2.6 - payment-methods + banks (23 scenarios)
# Run dari worktree root atau backend/. Backend dev server WAJIB jalan dulu.
set -u
BASE=http://localhost:8000/api

jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,300))}})"
}

status_only() {
  curl -s -o /tmp/_smoke_body.json -w "%{http_code}" "$@"
}

OWNER=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq_field 'console.log(j.data.token)')
JASON=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | jq_field 'console.log(j.data.token)')
AMEL=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Amel","pin":"222222"}' | jq_field 'console.log(j.data.token)')

if [ -z "$OWNER" ] || [ -z "$JASON" ] || [ -z "$AMEL" ]; then
  echo "FATAL: gagal login. Pastikan seed user sudah ada."
  exit 1
fi
echo "Tokens acquired: owner+jason+amel"

echo ""
echo "========== BANKS =========="

echo ""
echo "=== 1. Owner POST /banks Mandiri Syariah → 201 ==="
RESP=$(curl -s -w "\nstatus=%{http_code}" -X POST $BASE/banks -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"name":"Mandiri Syariah"}')
echo "$RESP" | head -c 400; echo
NEW_BANK_ID=$(echo "$RESP" | sed '$d' | jq_field 'console.log(j.data && j.data.bank ? j.data.bank.id : "")')
echo "New bank id=$NEW_BANK_ID"

echo ""
echo "=== 2. Owner POST duplicate 'mandiri syariah' (case-insensitive) → 409 ==="
status_only -X POST $BASE/banks -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"name":"mandiri syariah"}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 150))"

echo ""
echo "=== 3. Jason (kasir) POST /banks → 403 ==="
status_only -X POST $BASE/banks -H "Content-Type: application/json" -H "Authorization: Bearer $JASON" -d '{"name":"Test"}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 150))"

echo ""
echo "=== 4. Owner GET /banks → minimal 5 banks (BCA/Mandiri/BNI/BRI + Mandiri Syariah/Permata) ==="
curl -s $BASE/banks -H "Authorization: Bearer $OWNER" | jq_field 'console.log("count:", j.data.banks.length, "| names:", j.data.banks.map(b=>b.name).join(", "))'

echo ""
echo "=== 5. (combined w/ #4) Owner GET ?includeInactive=true → all banks ==="
curl -s "$BASE/banks?includeInactive=true" -H "Authorization: Bearer $OWNER" | jq_field 'console.log("count:", j.data.banks.length)'

echo ""
echo "========== PAYMENT METHODS =========="

echo ""
echo "=== 6. Owner POST /payment-methods ShopeePay (requiresBank=true + bankIds=[$NEW_BANK_ID]) → 201 ==="
RESP=$(curl -s -X POST $BASE/payment-methods -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d "{\"code\":\"shopeepay\",\"label\":\"ShopeePay\",\"colorHex\":\"#ee4d2d\",\"iconName\":\"Smartphone\",\"requiresBank\":true,\"bankIds\":[$NEW_BANK_ID]}")
echo "$RESP" | head -c 500; echo
SHOPEE_ID=$(echo "$RESP" | jq_field 'console.log(j.data && j.data.paymentMethod ? j.data.paymentMethod.id : "")')
echo "ShopeePay id=$SHOPEE_ID"

echo ""
echo "=== 7. Owner POST duplicate code 'shopeepay' → 409 ==="
status_only -X POST $BASE/payment-methods -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d "{\"code\":\"shopeepay\",\"label\":\"DupCheck\",\"colorHex\":\"#000000\",\"iconName\":\"Wallet\",\"requiresBank\":false}"
echo " (body: $(cat /tmp/_smoke_body.json | head -c 200))"

echo ""
echo "=== 8. Owner POST requiresBank=true + bankIds=[] → 400 ==="
status_only -X POST $BASE/payment-methods -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"code":"dummy_a","label":"Dummy A","colorHex":"#123456","iconName":"Wallet","requiresBank":true,"bankIds":[]}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 200))"

echo ""
echo "=== 9. Owner POST invalid colorHex 'red' → 422 ==="
status_only -X POST $BASE/payment-methods -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"code":"dummy_b","label":"Dummy B","colorHex":"red","iconName":"Wallet","requiresBank":false}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 200))"

echo ""
echo "=== 10. Owner POST invalid iconName 'Foo' → 422 ==="
status_only -X POST $BASE/payment-methods -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"code":"dummy_c","label":"Dummy C","colorHex":"#abcdef","iconName":"Foo","requiresBank":false}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 200))"

echo ""
echo "=== 11. Owner POST invalid code 'INVALID-Code' → 422 ==="
status_only -X POST $BASE/payment-methods -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"code":"INVALID-Code","label":"Bad","colorHex":"#abcdef","iconName":"Wallet","requiresBank":false}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 200))"

echo ""
echo "=== 12. Owner PATCH /payment-methods/$SHOPEE_ID label='ShopeePay Indonesia' → 200 ==="
curl -s -X PATCH $BASE/payment-methods/$SHOPEE_ID -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"label":"ShopeePay Indonesia"}' | jq_field 'console.log("label:", j.data.paymentMethod.label)'

echo ""
echo "=== 13. Owner PATCH toggle-active isActive:false → 200, hilang dari default list ==="
curl -s -X PATCH $BASE/payment-methods/$SHOPEE_ID/toggle-active -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"isActive":false}' | jq_field 'console.log("isActive:", j.data.paymentMethod.isActive)'
echo "  default list (isActive=true only):"
curl -s $BASE/payment-methods -H "Authorization: Bearer $OWNER" | jq_field 'const codes = j.data.paymentMethods.map(m=>m.code); console.log("  codes:", codes.join(","), "| includes shopeepay?", codes.includes("shopeepay"))'

echo ""
echo "=== 14. Owner GET ?includeInactive=true → ShopeePay muncul lagi ==="
curl -s "$BASE/payment-methods?includeInactive=true" -H "Authorization: Bearer $OWNER" | jq_field 'const codes = j.data.paymentMethods.map(m=>m.code); console.log("  codes:", codes.join(","), "| includes shopeepay?", codes.includes("shopeepay"))'

echo ""
echo "=== 15. Owner POST /payment-methods/$SHOPEE_ID/banks/1 assign BCA → 200 ==="
curl -s -X POST $BASE/payment-methods/$SHOPEE_ID/banks/1 -H "Authorization: Bearer $OWNER" | jq_field 'console.log("banks:", j.data.paymentMethod.banks.map(b=>b.name).join(","))'

echo ""
echo "=== 16. Owner DELETE /payment-methods/$SHOPEE_ID/banks/$NEW_BANK_ID (skrg ada 2 bank, harusnya OK karena bukan terakhir) → 200 ==="
curl -s -X DELETE $BASE/payment-methods/$SHOPEE_ID/banks/$NEW_BANK_ID -H "Authorization: Bearer $OWNER" | jq_field 'console.log("banks setelah unassign:", j.data.paymentMethod.banks.map(b=>b.name).join(","))'

echo "  Now coba unassign BCA (bank terakhir untuk method requiresBank=true) → expected 400"
status_only -X DELETE $BASE/payment-methods/$SHOPEE_ID/banks/1 -H "Authorization: Bearer $OWNER"
echo " (body: $(cat /tmp/_smoke_body.json | head -c 200))"

echo ""
echo "=== 17. Owner POST /payment-methods/reorder swap 2 method (cash<->edc) → 200 ==="
curl -s -X POST $BASE/payment-methods/reorder -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"ordered":[{"id":1,"displayOrder":2},{"id":2,"displayOrder":1}]}' | jq_field 'const m=j.data.paymentMethods; console.log("cash order:", m.find(x=>x.code==="cash").displayOrder, "edc order:", m.find(x=>x.code==="edc").displayOrder)'
echo "  Restore back to original (cash=1, edc=2):"
curl -s -X POST $BASE/payment-methods/reorder -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"ordered":[{"id":1,"displayOrder":1},{"id":2,"displayOrder":2}]}' > /dev/null
echo "  ✓ restored"

echo ""
echo "=== 18. Owner PATCH coba ubah code (field ga ada di updateSchema, harus ignored, body lain harus apply) → 200 ==="
RESP=$(curl -s -X PATCH $BASE/payment-methods/1 -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"code":"hacked","label":"Tunai (restored)"}')
echo "$RESP" | jq_field 'console.log("code:", j.data.paymentMethod.code, "label:", j.data.paymentMethod.label)'

echo ""
echo "=== 19. Owner PATCH cash requiresBank=true tapi cash blm punya bank → 400 ==="
status_only -X PATCH $BASE/payment-methods/1 -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"requiresBank":true}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 200))"

echo ""
echo "=== 20. Jason GET /payment-methods → 200 (semua role boleh) ==="
status_only -X GET $BASE/payment-methods -H "Authorization: Bearer $JASON"
echo " (count: $(cat /tmp/_smoke_body.json | jq_field 'console.log(j.data.paymentMethods.length)'))"

echo ""
echo "=== 21. Amel (waiter) GET /payment-methods → 200 ==="
status_only -X GET $BASE/payment-methods -H "Authorization: Bearer $AMEL"
echo " (count: $(cat /tmp/_smoke_body.json | jq_field 'console.log(j.data.paymentMethods.length)'))"

echo ""
echo "=== 22. Jason POST /payment-methods → 403 ==="
status_only -X POST $BASE/payment-methods -H "Content-Type: application/json" -H "Authorization: Bearer $JASON" -d '{"code":"jason_test","label":"Test","colorHex":"#000000","iconName":"Wallet","requiresBank":false}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 150))"

echo ""
echo "=== 23. Jason POST /banks → 403 ==="
status_only -X POST $BASE/banks -H "Content-Type: application/json" -H "Authorization: Bearer $JASON" -d '{"name":"Jason Test Bank"}'
echo " (body: $(cat /tmp/_smoke_body.json | head -c 150))"

echo ""
echo "========== SMOKE TEST DONE =========="
echo "Final state check:"
curl -s "$BASE/payment-methods?includeInactive=true" -H "Authorization: Bearer $OWNER" | jq_field 'console.log("payment_methods count:", j.data.paymentMethods.length)'
curl -s "$BASE/banks?includeInactive=true" -H "Authorization: Bearer $OWNER" | jq_field 'console.log("banks count:", j.data.banks.length)'
