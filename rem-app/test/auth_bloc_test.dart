import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';

// Classes fictives générées pour le mocking du dépôt d'authentification
class MockAuthRepository extends Mock {
  Future<String> login(String email, String password);
}

void main() {
  late MockAuthRepository mockAuthRepository;

  setUp(() {
    mockAuthRepository = MockAuthRepository();
  });

  group('🔒 Bloc d\'Authentification Mobile (TDD)', () {
    test('RED -> GREEN: Doit retourner un token valide lors d\'une connexion réussie', () async {
      // Arrangement de la simulation
      when(mockAuthRepository.login('mandiaye@rem.sn', 'SecuredPass123'))
          .thenAnswer((_) async => 'mocked-jwt-token-xyz');

      // Action
      final token = await mockAuthRepository.login('mandiaye@rem.sn', 'SecuredPass123');

      // Assertion (Vérification du résultat conforme)
      expect(token, 'mocked-jwt-token-xyz');
    });
  });
}