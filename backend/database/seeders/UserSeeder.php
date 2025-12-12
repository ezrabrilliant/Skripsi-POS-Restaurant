<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = [
            [
                'name' => 'Pak Budi',
                'role' => 'owner',
                'pin_code' => '123456',
                'is_active' => true,
            ],
            [
                'name' => 'Siti',
                'role' => 'cashier',
                'pin_code' => '111111',
                'is_active' => true,
            ],
            [
                'name' => 'Dewi',
                'role' => 'cashier',
                'pin_code' => '222222',
                'is_active' => true,
            ],
        ];

        foreach ($users as $user) {
            User::create($user);
        }
    }
}
