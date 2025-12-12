<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('daily_menu_stocks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('date');
            $table->foreignUuid('menu_id')->constrained('menus')->onDelete('cascade');
            $table->integer('stock_start')->default(0);
            $table->integer('stock_sold')->default(0);
            $table->timestamps();

            $table->unique(['date', 'menu_id']);
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_menu_stocks');
    }
};
