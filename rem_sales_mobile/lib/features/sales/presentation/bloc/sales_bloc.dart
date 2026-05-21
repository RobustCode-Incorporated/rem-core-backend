import 'dart:developer' as developer;
import '../../data/models/sales_document_model.dart';

abstract class SalesState {}
class SalesInitial extends SalesState {}
class SalesLoading extends SalesState {}
class SalesSuccess extends SalesState {
  final List<SalesDocument> documents;
  SalesSuccess(this.documents);
}
class SalesError extends SalesState {
  final String message;
  SalesError(this.message);
}

class SalesBloc {
  SalesState _state = SalesInitial();
  SalesState get state => _state;
  final List<SalesDocument> _mockPipeline = [];

  Future<void> createDocument(String clientId, String type, double amount) async {
    _state = SalesLoading();
    developer.log('[BLOC EVENT] Déclenchement de la création du document', name: 'REM.Sales');

    try {
      await Future.delayed(const Duration(milliseconds: 600));
      
      final newDoc = SalesDocument(
        id: 'local-uuid-${DateTime.now().millisecond}',
        type: type,
        number: '${type == 'QUOTE' ? 'DEV' : 'FAC'}-${DateTime.now().year}-${DateTime.now().millisecond}',
        status: 'DRAFT',
        totalAmount: amount,
        createdAt: DateTime.now(),
      );

      _mockPipeline.add(newDoc);
      _state = SalesSuccess(List.from(_mockPipeline));
      developer.log('[BLOC SUCCESS] Élément ajouté au pipeline: ${newDoc.number}', name: 'REM.Sales');
    } catch (e) {
      _state = SalesError(e.toString());
    }
  }
}
