<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Menu;
use App\Models\DailyMenuStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    /**
     * Get all transactions
     */
    public function index(Request $request): JsonResponse
    {
        $query = Transaction::with(['items', 'cashier']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        // Filter by table
        if ($request->has('table_number')) {
            $query->where('table_number', $request->table_number);
        }

        // Filter today only
        if ($request->boolean('today')) {
            $query->whereDate('created_at', now()->toDateString());
        }

        $transactions = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 50));

        return response()->json([
            'success' => true,
            'data' => $transactions->items(),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }

    /**
     * Get single transaction
     */
    public function show(string $id): JsonResponse
    {
        $transaction = Transaction::with(['items', 'cashier'])->find($id);

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $transaction,
        ]);
    }

    /**
     * Create new transaction (open bill)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'table_number' => 'required|string|max:20',
            'notes' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.menu_id' => 'required_with:items|uuid|exists:menus,id',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.notes' => 'nullable|string',
            'items.*.force_order' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Check if table already has an open transaction
        $existingTransaction = Transaction::where('table_number', $request->table_number)
            ->where('status', 'open')
            ->first();

        if ($existingTransaction) {
            return response()->json([
                'success' => false,
                'message' => 'Meja ini sudah memiliki transaksi yang belum dibayar',
                'data' => $existingTransaction->load('items'),
            ], 409);
        }

        $transaction = DB::transaction(function () use ($request) {
            $transaction = Transaction::create([
                'table_number' => $request->table_number,
                'status' => 'open',
                'cashier_id' => $request->user()->id,
                'notes' => $request->notes,
            ]);

            // Add items if provided
            if ($request->has('items') && is_array($request->items)) {
                $today = now()->toDateString();
                
                foreach ($request->items as $itemData) {
                    $menu = Menu::find($itemData['menu_id']);
                    $isForceOrder = $itemData['force_order'] ?? false;
                    
                    // Check and update stock
                    $stock = DailyMenuStock::where('menu_id', $menu->id)
                        ->where('date', $today)
                        ->first();
                    
                    if ($stock && !$isForceOrder) {
                        $stock->increment('stock_sold', $itemData['quantity']);
                    }
                    
                    TransactionItem::create([
                        'transaction_id' => $transaction->id,
                        'menu_id' => $menu->id,
                        'menu_name' => $menu->name,
                        'price' => $menu->price,
                        'quantity' => $itemData['quantity'],
                        'subtotal' => $menu->price * $itemData['quantity'],
                        'notes' => $itemData['notes'] ?? null,
                        'is_force_order' => $isForceOrder,
                    ]);
                }
                
                // Recalculate totals
                $transaction->recalculateTotals();
            }

            return $transaction;
        });

        return response()->json([
            'success' => true,
            'message' => 'Transaksi berhasil dibuat',
            'data' => $transaction->load('items'),
        ], 201);
    }

    /**
     * Add item to transaction
     */
    public function addItem(Request $request, string $id): JsonResponse
    {
        $transaction = Transaction::find($id);

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan',
            ], 404);
        }

        if (!$transaction->isOpen()) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi sudah ditutup',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'menu_id' => 'required|uuid|exists:menus,id',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
            'force_order' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $menu = Menu::find($request->menu_id);
        $today = now()->toDateString();

        // Check stock
        $stock = DailyMenuStock::where('menu_id', $menu->id)
            ->where('date', $today)
            ->first();

        $isForceOrder = false;
        if ($stock) {
            $stockRemaining = $stock->stock_remaining;
            if ($stockRemaining < $request->quantity) {
                if (!$request->boolean('force_order')) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Stock tidak mencukupi',
                        'data' => [
                            'stock_remaining' => $stockRemaining,
                            'requested' => $request->quantity,
                        ],
                    ], 400);
                }
                $isForceOrder = true;
            }
        } else {
            // No stock record for today
            if (!$request->boolean('force_order')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Stock belum diset untuk hari ini',
                ], 400);
            }
            $isForceOrder = true;
        }

        // Check if same menu already in transaction
        $existingItem = $transaction->items()
            ->where('menu_id', $menu->id)
            ->where('notes', $request->notes)
            ->first();

        if ($existingItem) {
            // Update quantity
            $existingItem->quantity += $request->quantity;
            $existingItem->subtotal = $existingItem->quantity * $existingItem->price_at_time;
            $existingItem->is_force_order = $existingItem->is_force_order || $isForceOrder;
            $existingItem->save();

            // Update stock
            if ($stock) {
                $stock->decreaseStock($request->quantity);
            }

            // Recalculate totals
            $transaction->calculateTotals();

            return response()->json([
                'success' => true,
                'message' => 'Item berhasil ditambahkan',
                'data' => $transaction->load('items'),
            ]);
        }

        // Create new item
        $item = TransactionItem::create([
            'transaction_id' => $transaction->id,
            'menu_id' => $menu->id,
            'menu_name' => $menu->name,
            'quantity' => $request->quantity,
            'price_at_time' => $menu->price,
            'subtotal' => $request->quantity * $menu->price,
            'notes' => $request->notes,
            'is_force_order' => $isForceOrder,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Item berhasil ditambahkan',
            'data' => $transaction->load('items'),
        ]);
    }

    /**
     * Update item quantity
     */
    public function updateItem(Request $request, string $id, string $itemId): JsonResponse
    {
        $transaction = Transaction::find($id);

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan',
            ], 404);
        }

        if (!$transaction->isOpen()) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi sudah ditutup',
            ], 400);
        }

        $item = TransactionItem::where('transaction_id', $id)->find($itemId);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item tidak ditemukan',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $oldQuantity = $item->quantity;
        $newQuantity = $request->quantity;
        $quantityDiff = $newQuantity - $oldQuantity;

        // Update stock if quantity changed
        if ($quantityDiff != 0) {
            $stock = DailyMenuStock::where('menu_id', $item->menu_id)
                ->where('date', now()->toDateString())
                ->first();

            if ($stock) {
                if ($quantityDiff > 0) {
                    $stock->decreaseStock($quantityDiff);
                } else {
                    $stock->increaseStock(abs($quantityDiff));
                }
            }
        }

        $item->quantity = $newQuantity;
        $item->subtotal = $newQuantity * $item->price_at_time;
        if ($request->has('notes')) {
            $item->notes = $request->notes;
        }
        $item->save();

        // Recalculate totals
        $transaction->calculateTotals();

        return response()->json([
            'success' => true,
            'message' => 'Item berhasil diupdate',
            'data' => $transaction->load('items'),
        ]);
    }

    /**
     * Remove item from transaction
     */
    public function removeItem(string $id, string $itemId): JsonResponse
    {
        $transaction = Transaction::find($id);

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan',
            ], 404);
        }

        if (!$transaction->isOpen()) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi sudah ditutup',
            ], 400);
        }

        $item = TransactionItem::where('transaction_id', $id)->find($itemId);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item tidak ditemukan',
            ], 404);
        }

        // Restore stock
        $stock = DailyMenuStock::where('menu_id', $item->menu_id)
            ->where('date', now()->toDateString())
            ->first();

        if ($stock) {
            $stock->increaseStock($item->quantity);
        }

        $item->delete();

        // Recalculate totals
        $transaction->calculateTotals();

        return response()->json([
            'success' => true,
            'message' => 'Item berhasil dihapus',
            'data' => $transaction->load('items'),
        ]);
    }

    /**
     * Sync all items in transaction (replace all items)
     */
    public function syncItems(Request $request, string $id): JsonResponse
    {
        $transaction = Transaction::find($id);

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan',
            ], 404);
        }

        if (!$transaction->isOpen()) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi sudah ditutup',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array',
            'items.*.menu_id' => 'required|uuid|exists:menus,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.notes' => 'nullable|string',
            'items.*.force_order' => 'nullable|boolean',
            'notes' => 'nullable|string',
            'discount_amount' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::transaction(function () use ($request, $transaction) {
            $today = now()->toDateString();
            
            // Restore stock from existing items
            foreach ($transaction->items as $existingItem) {
                $stock = DailyMenuStock::where('menu_id', $existingItem->menu_id)
                    ->where('date', $today)
                    ->first();
                if ($stock && !$existingItem->is_force_order) {
                    $stock->increment('stock_remaining', $existingItem->quantity);
                    $stock->decrement('stock_sold', $existingItem->quantity);
                }
            }
            
            // Delete all existing items
            $transaction->items()->delete();
            
            // Add new items
            foreach ($request->items as $itemData) {
                $menu = Menu::find($itemData['menu_id']);
                $isForceOrder = $itemData['force_order'] ?? false;
                
                // Decrease stock
                $stock = DailyMenuStock::where('menu_id', $menu->id)
                    ->where('date', $today)
                    ->first();
                
                if ($stock && !$isForceOrder) {
                    $stock->decrement('stock_remaining', $itemData['quantity']);
                    $stock->increment('stock_sold', $itemData['quantity']);
                }
                
                TransactionItem::create([
                    'transaction_id' => $transaction->id,
                    'menu_id' => $menu->id,
                    'menu_name' => $menu->name,
                    'price' => $menu->price,
                    'quantity' => $itemData['quantity'],
                    'subtotal' => $menu->price * $itemData['quantity'],
                    'notes' => $itemData['notes'] ?? null,
                    'is_force_order' => $isForceOrder,
                ]);
            }
            
            // Update transaction notes and discount
            if ($request->has('notes')) {
                $transaction->notes = $request->notes;
            }
            if ($request->has('discount_amount')) {
                $transaction->discount_amount = $request->discount_amount;
            }
            $transaction->save();
            
            // Recalculate totals
            $transaction->recalculateTotals();
        });

        return response()->json([
            'success' => true,
            'message' => 'Items berhasil diupdate',
            'data' => $transaction->fresh()->load('items'),
        ]);
    }

    /**
     * Process payment
     */
    public function pay(Request $request, string $id): JsonResponse
    {
        $transaction = Transaction::find($id);

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan',
            ], 404);
        }

        if (!$transaction->isOpen()) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi sudah ditutup',
            ], 400);
        }

        if ($transaction->items()->count() === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak memiliki item',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'payment_method' => 'required|string|in:cash,edc_bca,edc_mandiri,qris,transfer',
            'amount_paid' => 'required|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Apply discount if provided
        if ($request->has('discount_amount')) {
            $transaction->discount_amount = $request->discount_amount;
            $transaction->total_amount = $transaction->subtotal - $request->discount_amount;
        }

        // Check if amount paid is sufficient
        if ($request->amount_paid < $transaction->total_amount) {
            return response()->json([
                'success' => false,
                'message' => 'Jumlah pembayaran kurang',
                'data' => [
                    'total_amount' => $transaction->total_amount,
                    'amount_paid' => $request->amount_paid,
                ],
            ], 400);
        }

        // Process payment
        $transaction->processPayment($request->payment_method, $request->amount_paid);

        return response()->json([
            'success' => true,
            'message' => 'Pembayaran berhasil',
            'data' => $transaction->load('items'),
        ]);
    }

    /**
     * Void transaction
     */
    public function void(string $id): JsonResponse
    {
        $transaction = Transaction::find($id);

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi tidak ditemukan',
            ], 404);
        }

        if ($transaction->isVoid()) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi sudah divoid',
            ], 400);
        }

        $transaction->voidTransaction();

        return response()->json([
            'success' => true,
            'message' => 'Transaksi berhasil divoid',
            'data' => $transaction->load('items'),
        ]);
    }

    /**
     * Get transaction history (paid transactions)
     */
    public function history(Request $request): JsonResponse
    {
        $query = Transaction::with(['items', 'cashier'])
            ->where('status', 'paid');

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('paid_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('paid_at', '<=', $request->end_date);
        }

        // Filter today only
        if ($request->boolean('today')) {
            $query->whereDate('paid_at', now()->toDateString());
        }

        $transactions = $query->orderBy('paid_at', 'desc')
            ->paginate($request->get('per_page', 50));

        return response()->json([
            'success' => true,
            'data' => $transactions->items(),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }

    /**
     * Get daily sales summary
     */
    public function dailySummary(Request $request): JsonResponse
    {
        $date = $request->get('date', now()->toDateString());

        $transactions = Transaction::where('status', 'paid')
            ->whereDate('paid_at', $date)
            ->get();

        $summary = [
            'date' => $date,
            'total_transactions' => $transactions->count(),
            'cash_total' => $transactions->where('payment_method', 'cash')->sum('total_amount'),
            'edc_total' => $transactions->whereIn('payment_method', ['edc_bca', 'edc_mandiri'])->sum('total_amount'),
            'qris_total' => $transactions->where('payment_method', 'qris')->sum('total_amount'),
            'transfer_total' => $transactions->where('payment_method', 'transfer')->sum('total_amount'),
            'grand_total' => $transactions->sum('total_amount'),
        ];

        return response()->json([
            'success' => true,
            'data' => $summary,
        ]);
    }
}
