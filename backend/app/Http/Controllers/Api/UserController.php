<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    /**
     * Get all users
     */
    public function index(): JsonResponse
    {
        $users = User::orderBy('name')->get(['id', 'name', 'role', 'is_active', 'created_at']);

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * Get single user
     */
    public function show(string $id): JsonResponse
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
                'is_active' => $user->is_active,
                'created_at' => $user->created_at,
            ],
        ]);
    }

    /**
     * Create new user
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'role' => 'required|in:owner,cashier',
            'pin_code' => 'required|string|min:4|max:6|unique:users,pin_code',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'role' => $request->role,
            'pin_code' => $request->pin_code,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'User berhasil dibuat',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
                'is_active' => $user->is_active,
            ],
        ], 201);
    }

    /**
     * Update user
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'role' => 'sometimes|in:owner,cashier',
            'pin_code' => 'sometimes|string|min:4|max:6|unique:users,pin_code,' . $id,
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user->update($request->only(['name', 'role', 'pin_code', 'is_active']));

        return response()->json([
            'success' => true,
            'message' => 'User berhasil diupdate',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
                'is_active' => $user->is_active,
            ],
        ]);
    }

    /**
     * Delete user
     */
    public function destroy(string $id): JsonResponse
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan',
            ], 404);
        }

        // Soft delete - just deactivate
        $user->update(['is_active' => false]);

        return response()->json([
            'success' => true,
            'message' => 'User berhasil dinonaktifkan',
        ]);
    }
}
