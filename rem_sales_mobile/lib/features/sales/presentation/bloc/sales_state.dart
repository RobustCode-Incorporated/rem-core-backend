import 'package:equatable/equatable.dart';
import 'package:rem_sales_mobile/features/sales/data/models/product_model.dart';

abstract class SalesState extends Equatable {
  const SalesState();
  
  @override
  List<Object?> get props => [];
}

class SalesInitial extends SalesState {}

class SalesLoading extends SalesState {}

class SalesSuccess extends SalesState {}

class SalesError extends SalesState {
  final String message;

  const SalesError(this.message);

  @override
  List<Object?> get props => [message];
}

/// 📦 JALON INVENTORY : États spécifiques au chargement du catalogue d'articles local Isar
class ProductsLoading extends SalesState {}

class ProductsLoadSuccess extends SalesState {
  final List<ProductModel> products;

  const ProductsLoadSuccess(this.products);

  @override
  List<Object?> get props => [products];
}