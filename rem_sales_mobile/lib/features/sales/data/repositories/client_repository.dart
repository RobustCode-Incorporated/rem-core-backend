import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/client_model.dart';

class ClientRepository {
  final String baseUrl = 'http://localhost:3000/api/sales/clients';
  final String tempToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItdXVpZC05OTkiLCJlbWFpbCI6InRlc3RAYm91dGlxdWUuc24iLCJjb21wYW55SWQiOiJiZjMwY2QxMi05YzFkLTQwNzQtYjRhMC0wMDAwMDAwMDAwMDAiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NzkzODU1NDcsImV4cCI6MTkwMDAwMDAwMH0.3_XjR6v4M5X3V9XzU5N3g1NjhfOTg3NjU0MzIx';

  final http.Client client;

  ClientRepository({required this.client});

  Future<ClientModel> createClient({
    required String name,
    String? email,
    String? phone,
  }) async {
    final url = Uri.parse(baseUrl);

    final bodyData = {
      'name': name,
      'email': email,
      'phone': phone,
    };

    try {
      final response = await client.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $tempToken',
        },
        body: jsonEncode(bodyData),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        final decodedData = jsonDecode(response.body);
        return ClientModel.fromJson(decodedData['client'] as Map<String, dynamic>);
      } else {
        throw Exception('Échec API (${response.statusCode}): ${response.body}');
      }
    } catch (e) {
      throw Exception('Erreur de connexion réseau : $e');
    }
  }
}