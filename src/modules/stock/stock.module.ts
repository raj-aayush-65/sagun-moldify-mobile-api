import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { RawMaterialType } from './entities/raw-material-type.entity';
import { RawMaterialPurchase } from './entities/raw-material-purchase.entity';
import { Product } from './entities/product.entity';
import { Party } from './entities/party.entity';
import { SheetLineReport } from './entities/sheet-line-report.entity';
import { SheetLineMaterialUsage } from './entities/sheet-line-material-usage.entity';
import { SheetLineMixRatio } from './entities/sheet-line-mix-ratio.entity';
import { SheetLineWastage } from './entities/sheet-line-wastage.entity';
import { Roll } from './entities/roll.entity';
import { TfmProductionRecord } from './entities/tfm-production-record.entity';
import { TfmRollConsumption } from './entities/tfm-roll-consumption.entity';
import { TfmProductionOutput } from './entities/tfm-production-output.entity';
import { PrintingRecord } from './entities/printing-record.entity';
import { PackingRecord } from './entities/packing-record.entity';
import { Invoice } from './entities/invoice.entity';

// Controllers
import { RawMaterialTypesController } from './controllers/raw-material-types.controller';
import { RawMaterialPurchasesController } from './controllers/raw-material-purchases.controller';
import { RawMaterialLevelsController } from './controllers/raw-material-levels.controller';
import { ProductsController } from './controllers/products.controller';
import { PartiesController } from './controllers/parties.controller';
import { SheetLineController } from './controllers/sheet-line.controller';
import { RollsController } from './controllers/rolls.controller';
import { TfmController } from './controllers/tfm.controller';
import { PrintingController } from './controllers/printing.controller';
import { PackingController } from './controllers/packing.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { WastageController } from './controllers/wastage.controller';
import { FinishedGoodsController } from './controllers/finished-goods.controller';

// Services
import { RawMaterialService } from './services/raw-material.service';
import { ProductService } from './services/product.service';
import { PartyService } from './services/party.service';
import { SheetLineService } from './services/sheet-line.service';
import { RollService } from './services/roll.service';
import { TfmService } from './services/tfm.service';
import { PrintingService } from './services/printing.service';
import { PackingService } from './services/packing.service';
import { StockDashboardService } from './services/stock-dashboard.service';
import { WastageService } from './services/wastage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RawMaterialType,
      RawMaterialPurchase,
      Product,
      Party,
      SheetLineReport,
      SheetLineMaterialUsage,
      SheetLineMixRatio,
      SheetLineWastage,
      Roll,
      TfmProductionRecord,
      TfmRollConsumption,
      TfmProductionOutput,
      PrintingRecord,
      PackingRecord,
      Invoice,
    ]),
  ],
  controllers: [
    RawMaterialTypesController,
    RawMaterialPurchasesController,
    RawMaterialLevelsController,
    ProductsController,
    PartiesController,
    SheetLineController,
    RollsController,
    TfmController,
    PrintingController,
    PackingController,
    DashboardController,
    WastageController,
    FinishedGoodsController,
  ],
  providers: [
    RawMaterialService,
    ProductService,
    PartyService,
    SheetLineService,
    RollService,
    TfmService,
    PrintingService,
    PackingService,
    StockDashboardService,
    WastageService,
  ],
  exports: [RawMaterialService, ProductService, PartyService],
})
export class StockModule {}
