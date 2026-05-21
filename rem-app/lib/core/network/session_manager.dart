import 'dart:developer' as developer;

/// Interface de stockage sécurisé simulant l'utilisation de `flutter_secure_storage`.
/// Crucial pour maintenir la session active sur le terminal mobile sans connexion permanente.
class SessionManager {
  // Simulation d'une base de données clé-valeur chiffrée locale
  final Map<String, String> _secureStorageMock = {};

  /// Sauvegarde le token JWT de manière sécurisée
  Future<void> saveToken(String token) async {
    _secureStorageMock['jwt_token'] = token;
    developer.log('[SECURE STORAGE] Token utilisateur sauvegardé localement', name: 'REM.Security');
  }

  /// Récupère le token stocké pour l'injection dans les en-têtes HTTP de l'API
  Future<String?> getToken() async {
    final token = _secureStorageMock['jwt_token'];
    if (token != null) {
      developer.log('[SECURE STORAGE] Récupération d\'un token de session actif', name: 'REM.Security');
    }
    return token;
  }

  /// Déconnexion complète (Destruction de la session locale)
  Future<void> clearSession() async {
    _secureStorageMock.remove('jwt_token');
    developer.log('[SECURE STORAGE] Session purgée de l\'appareil', name: 'REM.Security');
  }
}