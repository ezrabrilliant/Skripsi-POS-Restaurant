<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use App\Models\DailyMenuStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class StockController extends Controller
{
    /**
     * Get today's stock for all menus
     */
    public function index(Request $request): JsonResponse
    {
        $date = $request->get('date', now()->toDateString());

        $stocks = DailyMenuStock::with('menu')
            ->where('date', $date)
            ->get()
            ->map(function ($stock) {
                return [
                    'id' => $stock->id,
                    'date' => $stock->date->format('Y-m-d'),
                    'menu_id' => $stock->menu_id,
                    'menu_name' => $stock->menu->name,
                    'category' => $stock->menu->category,
                    'price' => (float) $stock->menu->price,
                    'stock_start' => $stock->stock_start,
                    'stock_sold' => $stock->stock_sold,
                    'stock_remaining' => $stock->stock_remaining,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $stocks,
        ]);
    }

    /**
     * Set stock for a menu item (for a specific date)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'menu_id' => 'required|uuid|exists:menus,id',
            'stock_start' => 'required|integer|min:0',
            'date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $date = $request->get('date', now()->toDateString());

        $stock = DailyMenuStock::updateOrCreate(
            [
                'menu_id' => $request->menu_id,
                'date' => $date,
            ],
            [
                'stock_start' => $request->stock_start,
            ]
        );

        $stock->load('menu');

        return response()->json([
            'success' => true,
            'message' => 'Stock berhasil diset',
            'data' => [
                'id' => $stock->id,
                'date' => $stock->date->format('Y-m-d'),
                'menu_id' => $stock->menu_id,
                'menu_name' => $stock->menu->name,
                'stock_start' => $stock->stock_start,
                'stock_sold' => $stock->stock_sold,
                'stock_remaining' => $stock->stock_remaining,
            ],
        ], 201);
    }

    /**
     * Bulk set stock for multiple menus
     */
    public function bulkStore(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'stocks' => 'required|array',
            'stocks.*.menu_id' => 'required|uuid|exists:menus,id',
            'stocks.*.stock_start' => 'required|integer|min:0',
            'date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $date = $request->get('date', now()->toDateString());
        $results = [];

        DB::transaction(function () use ($request, $date, &$results) {
            foreach ($request->stocks as $stockData) {
                $stock = DailyMenuStock::updateOrCreate(
                    [
                        'menu_id' => $stockData['menu_id'],
                        'date' => $date,
                    ],
                    [
                        'stock_start' => $stockData['stock_start'],
                    ]
                );
                $results[] = $stock;
            }
        });

        return response()->json([
            'success' => true,
            'message' => count($results) . ' stock berhasil diset',
            'data' => $results,
        ], 201);
    }

    /**
     * Update stock for a menu item
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $stock = DailyMenuStock::find($id);

        if (!$stock) {
            return response()->json([
                'success' => false,
                'message' => 'Stock tidak ditemukan',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'stock_start' => 'sometimes|integer|min:0',
            'stock_sold' => 'sometimes|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $stock->update($request->only(['stock_start', 'stock_sold']));
        $stock->load('menu');

        return response()->json([
            'success' => true,
            'message' => 'Stock berhasil diupdate',
            'data' => [
                'id' => $stock->id,
                'date' => $stock->date->format('Y-m-d'),
                'menu_id' => $stock->menu_id,
                'menu_name' => $stock->menu->name,
                'stock_start' => $stock->stock_start,
                'stock_sold' => $stock->stock_sold,
                'stock_remaining' => $stock->stock_remaining,
            ],
        ]);
    }

    /**
     * Reset all stocks for today (for new day)
     */
    public function resetToday(): JsonResponse
    {
        $today = now()->toDateString();

        // Delete today's stocks
        DailyMenuStock::where('date', $today)->delete();

        return response()->json([
            'success' => true,
            'message' => 'Stock hari ini berhasil direset',
        ]);
    }

    /**
     * Copy yesterday's stock to today
     */
    public function copyFromYesterday(): JsonResponse
    {
        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();

        $yesterdayStocks = DailyMenuStock::where('date', $yesterday)->get();

        if ($yesterdayStocks->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada stock kemarin untuk dicopy',
            ], 404);
        }

        DB::transaction(function () use ($yesterdayStocks, $today) {
            foreach ($yesterdayStocks as $stock) {
                DailyMenuStock::updateOrCreate(
                    [
                        'menu_id' => $stock->menu_id,
                        'date' => $today,
                    ],
                    [
                        'stock_start' => $stock->stock_start,
                        'stock_sold' => 0,
                    ]
                );
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Stock dari kemarin berhasil dicopy ke hari ini',
        ]);
    }
}
