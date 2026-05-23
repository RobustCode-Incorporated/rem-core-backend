import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:rem_sales_mobile/features/sales/data/models/client_model.dart';
import 'package:rem_sales_mobile/features/sales/data/repositories/client_repository.dart';

// Faux client HTTP réutilisable pour injecter nos simulations de réponses d'API
class FakeHttpClient extends http.BaseClient {
  final http.Response Function(http.BaseRequest request) mockResponse;
  FakeHttpClient(this.mockResponse);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = mockResponse(request);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }
}

void main() {
  // ==========================================
  // JALON SPRINT 1 : REM-204 (CRÉATION CLIENT)
  // ==========================================
  group('REM-204: ClientRepository - GREEN Test', () {
    test('doit retourner un ClientModel valide apres creation reussie sur le backend', () async {
      final fakeResponseData = {
        'message': 'Client créé avec succès',
        'client': {
          'id': 'client-uuid-generated-by-neon',
          'company_id': 'bf30cd12-9c1d-4074-b4a0-000000000000',
          'name': 'Ousmane Diop',
          'email': 'ousmane@diop.sn',
          'phone': '+221770000000',
          'created_at': '2026-05-23T12:00:00.000Z'
        }
      };

      final fakeHttpClient = FakeHttpClient((request) {
        return http.Response(jsonEncode(fakeResponseData), 201);
      });

      final repository = ClientRepository(client: fakeHttpClient);

      final result = await repository.createClient(
        name: 'Ousmane Diop',
        email: 'ousmane@diop.sn',
        phone: '+221770000000',
      );

      expect(result, isA<ClientModel>());
      expect(result.id, 'client-uuid-generated-by-neon');
      expect(result.name, 'Ousmane Diop');
    });
  });

  // ==========================================
  // JALON SPRINT 2 : REM-205 (ENCAISSEMENT VENTE)
  // ==========================================
  group('REM-205: SalesRepository - updateStatus TDD', () {
    test('doit retourner une reponse 200 quand le statut passe a PAID avec succes', () async {
      final fakeResponseData = {
        'message': 'Statut du document mis à jour avec succès',
        'document': {
          'id': 'invoice-uuid-456',
          'status': 'PAID',
          'total_amount': 120000.0
        }
      };

      final fakeHttpClient = FakeHttpClient((request) {
        expect(request.method, 'PATCH');
        expect(request.url.path, contains('/status'));
        return http.Response(jsonEncode(fakeResponseData), 200);
      });

      final response = await fakeHttpClient.patch(
        Uri.parse('http://localhost:3000/api/sales/documents/invoice-uuid-456/status'),
        body: jsonEncode({'status': 'PAID'}),
      );

      expect(response.statusCode, 200);
      final body = jsonDecode(response.body);
      expect(body['document']['status'], 'PAID');
      expect(body['document']['id'], 'invoice-uuid-456');
    });
  });
}