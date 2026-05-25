import 'package:isar/isar.dart';

// Génère le fichier de support Isar (Indispensable pour la génération de code Isar)
part 'product_model.g.dart';

@collection
class ProductModel {
  Id id = Isar.autoIncrement; // ID local auto-généré pour le téléphone

  @Index(unique: true, replace: true)
  String? serverId; // ID unique provenant de la base PostgreSQL/Neon (UUID)

  @Index()
  late String companyId; // Clé de cloisonnement Multi-Tenant

  late String name;        // Nom du produit (ex: Sac de ciment 50kg, Paracétamol)
  String? code;            // Code-barres ou SKU pour la douchette / caméra
  String? description;     // Description rapide de l'article

  late double purchasePrice; // Prix d'achat (utile pour calculer les marges dans REM Analytics)
  late double sellingPrice;  // Prix de vente par défaut
  
  late int stockQuantity;    // Quantité actuellement disponible en magasin
  int minStockAlert = 5;     // Seuil critique pour déclencher l'alerte de rupture

  // Constructeur propre
  ProductModel({
    this.id = Isar.autoIncrement,
    this.serverId,
    required this.companyId,
    required this.name,
    this.code,
    this.description,
    required this.purchasePrice,
    required this.sellingPrice,
    required this.stockQuantity,
    this.minStockAlert = 5,
  });

  // 🔄 Sérialisation : Convertir un JSON du Backend Node.js en modèle Isar local
  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      serverId: json['id'] as String?,
      companyId: json['company_id'] as String,
      name: json['name'] as String,
      code: json['code'] as String?,
      description: json['description'] as String?,
      purchasePrice: (json['purchase_price'] as num).toDouble(),
      sellingPrice: (json['selling_price'] as num).toDouble(),
      stockQuantity: json['stock_quantity'] as int,
      minStockAlert: json['min_stock_alert'] as int? ?? 5,
    );
  }

  // 🔄 Désérialisation : Convertir le modèle Isar en JSON pour l'envoyer au Cloud
  Map<String, dynamic> toJson() {
    return {
      if (serverId != null) 'id': serverId,
      'company_id': companyId,
      'name': name,
      'code': code,
      'description': description,
      'purchase_price': purchasePrice,
      'selling_price': sellingPrice,
      'stock_quantity': stockQuantity,
      'min_stock_alert': minStockAlert,
    };
  }
}