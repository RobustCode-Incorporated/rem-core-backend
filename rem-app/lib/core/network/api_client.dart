import 'dart:developer' as developer;

/// Client API ultra-léger pour le marché africain.
/// Optimisé pour journaliser précisément les temps de réponse et statuts.
class ApiClient {
  final String baseUrl;

  ApiClient({required this.baseUrl});

  Future<Map<String, dynamic>> get(String endpoint) async {
    final stopwatch = Stopwatch()..start();
    developer.log('[API REQUEST] GET $baseUrl$endpoint', name: 'REM.Network');

    try {
      // Simulation d'un appel réseau (À remplacer par l'implémentation de la dépendance http ou dio)
      await Future.delayed(const Duration(milliseconds: 400));
      stopwatch.stop();
      
      developer.log(
        '[API RESPONSE] 200 OK en ${stopwatch.elapsedMilliseconds}ms', 
        name: 'REM.Network'
      );
      
      return {'status': 'success', 'data': []};
    } catch (e) {
      developer.log('[API ERROR] Échec lors de la requête sur $endpoint: $e', 
        name: 'REM.Network', 
        error: e
      );
      rethrow;
    }
  }
}