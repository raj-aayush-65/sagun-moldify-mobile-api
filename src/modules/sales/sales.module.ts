import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { BoxVariant } from './entities/box-variant.entity';
import { Company } from './entities/company.entity';
import { StockEntry } from './entities/stock-entry.entity';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';

// Controllers
import { BoxVariantsController } from './controllers/box-variants.controller';
import { CompaniesController } from './controllers/companies.controller';
import { BoxStockController } from './controllers/box-stock.controller';
import { SalesController } from './controllers/sales.controller';

// Services
import { BoxVariantService } from './services/box-variant.service';
import { CompanyService } from './services/company.service';
import { BoxStockService } from './services/box-stock.service';
import { SaleService } from './services/sale.service';

@Module({
  imports: [TypeOrmModule.forFeature([BoxVariant, Company, StockEntry, Sale, SaleItem])],
  controllers: [BoxVariantsController, CompaniesController, BoxStockController, SalesController],
  providers: [BoxVariantService, CompanyService, BoxStockService, SaleService],
  exports: [BoxStockService, SaleService],
})
export class SalesModule {}
