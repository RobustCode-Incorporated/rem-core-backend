import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:rem_sales_mobile/features/sales/data/repositories/sales_repository.dart';
import 'sales_event.dart';
import 'sales_state.dart';

class SalesBloc extends Bloc<SalesEvent, SalesState> {
  final SalesRepository salesRepository;

  SalesBloc({required this.salesRepository}) : super(SalesInitial()) {
    // Association des événements à leurs fonctions de traitement
    on<SaveDocumentEvent>(_onSaveDocument);
    on<LoadProductsEvent>(_onLoadProducts); // 📦 Événement catalogue activé
  }

  Future<void> _onSaveDocument(SaveDocumentEvent event, Emitter<SalesState> emit) async {
    emit(SalesLoading());
    try {
      // Appel à notre repository qui gère la persistence Isar ++ la synchro réseau
      await salesRepository.saveSalesDocument(event.document);
      emit(SalesSuccess());
    } catch (e) {
      emit(SalesError(e.toString()));
    }
  }

  /// 📦 Traitement du chargement du catalogue d'articles (Multi-Tenant + Seed Offline)
  Future<void> _onLoadProducts(LoadProductsEvent event, Emitter<SalesState> emit) async {
    emit(ProductsLoading());
    try {
      // 1. Par sécurité (Offline-First), on injecte le Seed Data si Isar est vide
      await salesRepository.seedProductsIfEmpty(event.companyId);

      // 2. Récupération des produits filtrés par entreprise (Multi-Tenant)
      final activeProducts = await salesRepository.getProductsByCompany(event.companyId);

      // 3. On émet le succès avec la liste des produits réels
      emit(ProductsLoadSuccess(activeProducts));
    } catch (e) {
      emit(SalesError("Erreur lors du chargement du catalogue : ${e.toString()}"));
    }
  }
}