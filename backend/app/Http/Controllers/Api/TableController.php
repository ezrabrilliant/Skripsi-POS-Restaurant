<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TableController extends Controller
{
    /**
     * Get all tables status
     */
    public function index(Request $request): JsonResponse
    {
        $totalTables = $request->get('total', 20);
        
        // Get all open transactions
        $openTransactions = Transaction::with('items')
            ->where('status', 'open')
            ->get()
            ->keyBy('table_number');

        $tables = [];
        for ($i = 1; $i <= $totalTables; $i++) {
            $tableNumber = (string) $i;
            $transaction = $openTransactions->get($tableNumber);
            
            $tables[] = [
                'table_number' => $tableNumber,
                'status' => $transaction ? 'occupied' : 'available',
                'transaction' => $transaction ? [
                    'id' => $transaction->id,
                    'total_amount' => (float) $transaction->total_amount,
                    'item_count' => $transaction->items->sum('quantity'),
                    'created_at' => $transaction->created_at->toISOString(),
                ] : null,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $tables,
        ]);
    }

    /**
     * Get specific table status
     */
    public function show(string $tableNumber): JsonResponse
    {
        $transaction = Transaction::with('items')
            ->where('table_number', $tableNumber)
            ->where('status', 'open')
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'table_number' => $tableNumber,
                'status' => $transaction ? 'occupied' : 'available',
                'transaction' => $transaction,
            ],
        ]);
    }

    /**
     * Get open transaction for a table
     */
    public function getOpenTransaction(string $tableNumber): JsonResponse
    {
        $transaction = Transaction::with(['items', 'cashier'])
            ->where('table_number', $tableNumber)
            ->where('status', 'open')
            ->first();

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada transaksi aktif di meja ini',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $transaction,
        ]);
    }

    /**
     * Transfer transaction to another table
     */
    public function transfer(Request $request, string $fromTable): JsonResponse
    {
        $request->validate([
            'to_table' => 'required|string|max:20',
        ]);

        $toTable = $request->to_table;

        // Check if from table has open transaction
        $transaction = Transaction::where('table_number', $fromTable)
            ->where('status', 'open')
            ->first();

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada transaksi aktif di meja ' . $fromTable,
            ], 404);
        }

        // Check if destination table is empty
        $destinationTransaction = Transaction::where('table_number', $toTable)
            ->where('status', 'open')
            ->first();

        if ($destinationTransaction) {
            return response()->json([
                'success' => false,
                'message' => 'Meja ' . $toTable . ' sudah memiliki transaksi aktif',
            ], 409);
        }

        // Transfer
        $transaction->table_number = $toTable;
        $transaction->save();

        return response()->json([
            'success' => true,
            'message' => 'Transaksi berhasil dipindahkan ke meja ' . $toTable,
            'data' => $transaction->load('items'),
        ]);
    }
}
