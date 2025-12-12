<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use App\Models\DailyMenuStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MenuController extends Controller
{
    /**
     * Get all menus with today's stock
     */
    public function index(Request $request): JsonResponse
    {
        $query = Menu::query();

        // Filter by category
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Filter by active status
        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        } else {
            $query->where('is_active', true);
        }

        // Search by name
        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $menus = $query->orderBy('category')->orderBy('name')->get();

        // Get today's stock for all menus
        $today = now()->toDateString();
        $todayStocks = DailyMenuStock::where('date', $today)
            ->get()
            ->keyBy('menu_id');

        $menusWithStock = $menus->map(function ($menu) use ($todayStocks) {
            $stock = $todayStocks->get($menu->id);
            return [
                'id' => $menu->id,
                'name' => $menu->name,
                'price' => (float) $menu->price,
                'category' => $menu->category,
                'description' => $menu->description,
                'is_active' => $menu->is_active,
                'stock_start' => $stock ? $stock->stock_start : 0,
                'stock_sold' => $stock ? $stock->stock_sold : 0,
                'stock_remaining' => $stock ? $stock->stock_remaining : 0,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $menusWithStock,
        ]);
    }

    /**
     * Get distinct categories
     */
    public function categories(): JsonResponse
    {
        $categories = Menu::where('is_active', true)
            ->distinct()
            ->pluck('category')
            ->sort()
            ->values();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Get single menu
     */
    public function show(string $id): JsonResponse
    {
        $menu = Menu::find($id);

        if (!$menu) {
            return response()->json([
                'success' => false,
                'message' => 'Menu tidak ditemukan',
            ], 404);
        }

        $stock = $menu->getTodayStock();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $menu->id,
                'name' => $menu->name,
                'price' => (float) $menu->price,
                'category' => $menu->category,
                'description' => $menu->description,
                'is_active' => $menu->is_active,
                'stock_start' => $stock ? $stock->stock_start : 0,
                'stock_sold' => $stock ? $stock->stock_sold : 0,
                'stock_remaining' => $stock ? $stock->stock_remaining : 0,
            ],
        ]);
    }

    /**
     * Create new menu
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'price' => 'required|numeric|min:0',
            'category' => 'required|string|max:50',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $menu = Menu::create([
            'name' => $request->name,
            'price' => $request->price,
            'category' => $request->category,
            'description' => $request->description,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Menu berhasil dibuat',
            'data' => $menu,
        ], 201);
    }

    /**
     * Update menu
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $menu = Menu::find($id);

        if (!$menu) {
            return response()->json([
                'success' => false,
                'message' => 'Menu tidak ditemukan',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:150',
            'price' => 'sometimes|numeric|min:0',
            'category' => 'sometimes|string|max:50',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $menu->update($request->only(['name', 'price', 'category', 'description', 'is_active']));

        return response()->json([
            'success' => true,
            'message' => 'Menu berhasil diupdate',
            'data' => $menu,
        ]);
    }

    /**
     * Delete menu
     */
    public function destroy(string $id): JsonResponse
    {
        $menu = Menu::find($id);

        if (!$menu) {
            return response()->json([
                'success' => false,
                'message' => 'Menu tidak ditemukan',
            ], 404);
        }

        // Soft delete - just deactivate
        $menu->update(['is_active' => false]);

        return response()->json([
            'success' => true,
            'message' => 'Menu berhasil dinonaktifkan',
        ]);
    }
}
