<?php

namespace Database\Seeders;

use App\Models\Menu;
use App\Models\DailyMenuStock;
use Illuminate\Database\Seeder;

class MenuSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $menus = [
            // Ayam Bakar
            ['name' => '1 Ekor Ayam Bakar', 'price' => 120000, 'category' => 'Ayam Bakar'],
            ['name' => 'Paha Ayam Bakar', 'price' => 30000, 'category' => 'Ayam Bakar'],
            ['name' => 'Dada Ayam Bakar', 'price' => 30000, 'category' => 'Ayam Bakar'],
            ['name' => 'Ati / Ampela Bakar', 'price' => 5000, 'category' => 'Ayam Bakar'],
            ['name' => 'Kepala Ayam Bakar', 'price' => 2500, 'category' => 'Ayam Bakar'],

            // Ayam Goreng
            ['name' => '1 Ekor Ayam Goreng', 'price' => 120000, 'category' => 'Ayam Goreng'],
            ['name' => 'Paha Ayam Goreng', 'price' => 30000, 'category' => 'Ayam Goreng'],
            ['name' => 'Dada Ayam Goreng', 'price' => 30000, 'category' => 'Ayam Goreng'],
            ['name' => 'Ati / Ampela Goreng', 'price' => 5000, 'category' => 'Ayam Goreng'],
            ['name' => 'Kepala Ayam Goreng', 'price' => 2500, 'category' => 'Ayam Goreng'],

            // Daging Sapi
            ['name' => 'Daging Sapi Yakiniku', 'price' => 125000, 'category' => 'Daging Sapi'],
            ['name' => 'Empal Goreng', 'price' => 25000, 'category' => 'Daging Sapi'],

            // Aneka Seafood
            ['name' => 'Udang Bakar', 'price' => 150000, 'category' => 'Aneka Seafood'],
            ['name' => 'Gurame Bakar', 'price' => 125000, 'category' => 'Aneka Seafood'],

            // Aneka Kuah
            ['name' => 'Ayam Kuah Tauco', 'price' => 35000, 'category' => 'Aneka Kuah'],
            ['name' => 'Semur Daging', 'price' => 30000, 'category' => 'Aneka Kuah'],
            ['name' => 'Gulai Daging', 'price' => 30000, 'category' => 'Aneka Kuah'],
            ['name' => 'Rawon', 'price' => 30000, 'category' => 'Aneka Kuah'],
            ['name' => 'Garang Asem', 'price' => 30000, 'category' => 'Aneka Kuah'],

            // Aneka Sayur
            ['name' => 'Urap - Urap', 'price' => 12000, 'category' => 'Aneka Sayur'],
            ['name' => 'Cah Kangkung', 'price' => 10000, 'category' => 'Aneka Sayur'],
            ['name' => 'Sayur Asem', 'price' => 10000, 'category' => 'Aneka Sayur'],

            // Penyetan
            ['name' => 'Bakwan Penyet', 'price' => 25000, 'category' => 'Penyetan'],
            ['name' => 'Empal Penyet', 'price' => 25000, 'category' => 'Penyetan'],
            ['name' => '3T (Tahu Tempe Telur)', 'price' => 20000, 'category' => 'Penyetan'],
            ['name' => 'Tahu Tempe Penyet', 'price' => 15000, 'category' => 'Penyetan'],

            // Paketan
            ['name' => 'Paket A (Makan Ditempat)', 'price' => 50000, 'category' => 'Paketan', 'description' => 'Paha/Dada, Tahu Tempe, Sayur Asem, Nasi Putih, Air Mineral/Teh Tawar'],
            ['name' => 'Paket B (TakeAway)', 'price' => 40000, 'category' => 'Paketan', 'description' => 'Paha/Dada, Tahu Tempe, Nasi Putih'],

            // Lainnya
            ['name' => 'Petai Goreng', 'price' => 20000, 'category' => 'Lainnya'],
            ['name' => 'Tahu & Tempe Goreng', 'price' => 12000, 'category' => 'Lainnya'],
            ['name' => 'Tahu Goreng', 'price' => 10000, 'category' => 'Lainnya'],
            ['name' => 'Tempe Goreng', 'price' => 10000, 'category' => 'Lainnya'],
            ['name' => 'Telur Mata Sapi', 'price' => 10000, 'category' => 'Lainnya'],
            ['name' => 'Nasi Putih', 'price' => 10000, 'category' => 'Lainnya'],

            // Minuman
            ['name' => 'Air Mineral', 'price' => 5000, 'category' => 'Minuman'],
            ['name' => 'Teh Tawar Biasa', 'price' => 8000, 'category' => 'Minuman'],
            ['name' => 'Teh Tawar Jumbo', 'price' => 12000, 'category' => 'Minuman'],
            ['name' => 'Teh Manis Biasa', 'price' => 10000, 'category' => 'Minuman'],
            ['name' => 'Teh Manis Jumbo', 'price' => 15000, 'category' => 'Minuman'],
            ['name' => 'Es Sirup', 'price' => 10000, 'category' => 'Minuman'],
            ['name' => 'Jeruk Nipis', 'price' => 10000, 'category' => 'Minuman'],
            ['name' => 'Susu Kedelai', 'price' => 12000, 'category' => 'Minuman'],
            ['name' => 'Teh Kendur', 'price' => 12000, 'category' => 'Minuman'],
            ['name' => 'Es Tebu', 'price' => 12000, 'category' => 'Minuman'],
            ['name' => 'Es Cincau', 'price' => 12000, 'category' => 'Minuman'],
            ['name' => 'Es Degan', 'price' => 15000, 'category' => 'Minuman'],
            ['name' => 'Jeruk Peras', 'price' => 15000, 'category' => 'Minuman'],
            ['name' => 'Jeruk Murni', 'price' => 25000, 'category' => 'Minuman'],
            ['name' => 'Minuman Sarang Burung', 'price' => 80000, 'category' => 'Minuman'],
        ];

        $today = now()->toDateString();

        foreach ($menus as $menuData) {
            $menu = Menu::create([
                'name' => $menuData['name'],
                'price' => $menuData['price'],
                'category' => $menuData['category'],
                'description' => $menuData['description'] ?? null,
                'is_active' => true,
            ]);

            // Set initial stock for today
            DailyMenuStock::create([
                'date' => $today,
                'menu_id' => $menu->id,
                'stock_start' => rand(20, 50),
                'stock_sold' => 0,
            ]);
        }
    }
}