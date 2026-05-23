import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/sales_document_model.dart';

class SalesRepository {
  final http.Client _client;
  final String tempToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItdXVpZC05OTkiLCJlbWFpbCI6InRlc3RAYm91dGlxdWUuc24iLCJjb21wYW55SWQiOiJiZjMwY2QxMi05YzFkLTQwNzQtYjRhMC0wMDAwMDAwMDAwMDAiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NzkzODU1NDcsImV4cCI6MTkwMDAwMDAwMH0.3_XjR6v4M5X3V9XzU5N3g1NjhfOTg3NjU0MzIx';

  // Constructeur flexible (accepte un client injecté pour les tests, ou en crée un par défaut)
  SalesRepository({http.Client? client}) : _client = client ?? http.Client();

  /// 1. Création d'un document (Devis ou Facture)
  Future<SalesDocument> sendDocumentToBackend({
    required String clientId,
    required String type,
    required double amount,
  }) async {
    final url = Uri.parse('http://localhost:3000/api/sales/documents');
    
    try {
      final response = await _client.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $tempToken',
        },
        body: jsonEncode({
          'clientId': clientId,
          'type': type,
          'amount': amount,
          'total_amount': amount,
          'totalAmount': amount,
          // Remplissage complet des deux formats de clés pour neutraliser le destructurage du controlleur backend
          'items': [
            {
              'product_id': '00000000-0000-0000-0000-000000000000', 
              'productId': '00000000-0000-0000-0000-000000000000',
              'quantity': 1,
              'unit_price': amount,
              'unitPrice': amount,
              'total_price': amount,
              'totalPrice': amount,
              'name': 'Prestation / Vente Terrain'
            }
          ]
        }),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final docData = data['document'] ?? data; 
        return SalesDocument.fromJson(docData);
      } else {
        throw Exception('Échec API (${response.statusCode}): ${response.body}');
      }
    } catch (e) {
      throw Exception('Erreur de connexion réseau : $e');
    }
  }

  /// 2. Mise à jour du statut (REM-205 : Encaissement)
  Future<bool> updateDocumentStatus({
    required String documentId,
    required String newStatus,
  }) async {
    final url = Uri.parse('http://localhost:3000/api/sales/documents/$documentId/status');

    try {
      final response = await _client.patch(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $tempToken',
        },
        body: jsonEncode({
          'status': newStatus,
        }),
      );

      if (response.statusCode == 200) {
        return true;
      } else {
        throw Exception('Échec de la mise à jour (${response.statusCode}): ${response.body}');
      }
    } catch (e) {
      throw Exception('Erreur réseau lors du changement de statut : $e');
    }
  }
}