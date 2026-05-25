import 'package:isar/isar.dart';
import 'package:rem_sales_mobile/features/sales/data/models/local_sales_document.dart';
import 'package:rem_sales_mobile/features/sales/data/models/sales_document_model.dart';
import 'package:rem_sales_mobile/features/sales/data/models/product_model.dart'; // 📦 AJOUT : Import du modèle de produit
import 'package:rem_sales_mobile/features/sales/data/datasources/sync_manager.dart';

class SalesRepository {
  final Isar isar;
  final SyncManager syncManager;

  SalesRepository({
    required this.isar,
    required this.syncManager,
  });

  /// 📦 Sauvegarde le document localement et déclenche la synchronisation asynchrone
  Future<void> saveSalesDocument(SalesDocument document) async {
    // 1. Conversion du modèle de l'application vers le modèle de persistance locale Isar
    final localDoc = LocalSalesDocument.fromSalesDocument(document, synced: false);

    // 2. Écriture dans le stockage local (toujours prioritaire en Offline-First)
    await isar.writeTxn(() async {
      await isar.localSalesDocuments.put(localDoc);
    });

    // 3. Tentative de synchronisation en tâche de fond avec le backend
    await syncManager.synchronizeDocument(document.id);
  }

  /// 💳 JALON REM-205 : Met à jour le statut du document (ex: Passage à PAID lors d'un encaissement)
  Future<void> updateStatus({required String documentId, required String newStatus}) async {
    // 1. Recherche du document en local
    final localDoc = await isar.localSalesDocuments
        .filter()
        .idEqualTo(documentId)
        .findFirst();

    if (localDoc == null) {
      throw Exception('Document introuvable en local : $documentId');
    }

    // 2. Mise à jour locale du statut et bascule du drapeau de synchro à false
    await isar.writeTxn(() async {
      localDoc.status = newStatus;
      localDoc.isSynced = false; // Repasse à false car la donnée locale est plus fraîche que le serveur !
      await isar.localSalesDocuments.put(localDoc);
    });

    // 3. On pousse la mise à jour réseau
    await syncManager.synchronizeDocument(documentId);
  }

  /// 📦 JALON INVENTORY : Récupérer les produits du catalogue pour une entreprise spécifique (Multi-Tenant)
  Future<List<ProductModel>> getProductsByCompany(String companyId) async {
    return await isar.productModels
        .filter()
        .companyIdEqualTo(companyId)
        .findAll();
  }

  /// 🌱 JALON INVENTORY : Seed Data : Injecter des produits de test si le catalogue local est complètement vide
  Future<void> seedProductsIfEmpty(String companyId) async {
    final count = await isar.productModels.count();
    if (count == 0) {
      final dummyProducts = [
        ProductModel(
          companyId: companyId,
          name: 'Sac de Ciment 50kg (Génie Civil)',
          purchasePrice: 3500.0,
          sellingPrice: 4500.0,
          stockQuantity: 150,
          code: 'CIM-50K',
        ),
        ProductModel(
          companyId: companyId,
          name: 'Fer à béton ø12 (Barre de 12m)',
          purchasePrice: 4200.0,
          sellingPrice: 5200.0,
          stockQuantity: 80,
          code: 'FER-12MM',
        ),
        ProductModel(
          companyId: companyId,
          name: 'Pointe de charpente 100mm (Kg)',
          purchasePrice: 800.0,
          sellingPrice: 1200.0,
          stockQuantity: 25,
          minStockAlert: 5,
          code: 'PT-100',
        ),
      ];

      // Écriture sécurisée dans la transaction Isar
      await isar.writeTxn(() async {
        await isar.productModels.putAll(dummyProducts);
      });
    }
  }
}