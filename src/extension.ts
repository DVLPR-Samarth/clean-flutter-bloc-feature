import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'clean-flutter-bloc-feature.generateFeature',
    async (uri: vscode.Uri) => {
      try {
        // Determine base path
        let basePath = uri?.fsPath || '';
        const clickedPath = basePath;
        
        // Check if user right-clicked on features folder or inside it
        const isInsideFeaturesFolder = clickedPath?.includes('features') || false;
        
        if (isInsideFeaturesFolder) {
          // User is in features folder - find the lib folder
          // Go up from features to lib
          const parts = clickedPath.split(path.sep);
          const libIndex = parts.lastIndexOf('lib');
          if (libIndex !== -1) {
            basePath = parts.slice(0, libIndex + 1).join(path.sep);
          } else {
            basePath = path.join(clickedPath, '..', '..'); // Fallback
          }
        } else if (!basePath || !basePath.endsWith('lib')) {
          basePath = path.join(basePath || '', 'lib');
        }

        // Check if core already exists
        const corePath = path.join(basePath, 'core');
        const coreExists = fs.existsSync(corePath);

        // Show menu only if NOT in features folder
        let option: string | undefined = 'Add New Feature';
        if (!isInsideFeaturesFolder) {
          if (!coreExists) {
            option = await vscode.window.showQuickPick(
              ['Create Full Project Structure', 'Cancel'],
              { placeHolder: 'First time setup: Create core structure + feature?' }
            );
          } else {
            option = await vscode.window.showQuickPick(
              ['Add New Feature', 'Cancel'],
              { placeHolder: 'What do you want to do?' }
            );
          }
        }

        if (!option || option === 'Cancel') return;

        // Ask for feature name
        const featureName = await vscode.window.showInputBox({
          placeHolder: 'Enter feature name (e.g., auth, products)',
          prompt: 'Feature name (lowercase, no spaces)',
          validateInput: (value) => {
            if (!value) return 'Feature name is required';
            if (!/^[a-z_]+$/.test(value)) return 'Use only lowercase letters and underscores';
            return '';
          }
        });

        if (!featureName) return;

        // Create core structure first (only if doesn't exist)
        if (!coreExists) {
          createCoreStructure(basePath);
        }

        const pascal = toPascalCase(featureName);
        const camel = featureName.charAt(0).toLowerCase() + featureName.slice(1);

        // Create feature structure
        const featurePath = path.join(basePath, 'features', featureName);

        // Create all directories
        const dirs = [
          path.join(featurePath, 'data', 'datasources'),
          path.join(featurePath, 'data', 'models'),
          path.join(featurePath, 'data', 'repositories'),
          path.join(featurePath, 'domain', 'entities'),
          path.join(featurePath, 'domain', 'repositories'),
          path.join(featurePath, 'domain', 'usecases'),
          path.join(featurePath, 'presentation', 'bloc'),
          path.join(featurePath, 'presentation', 'pages'),
        ];

        dirs.forEach(dir => {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        });

        // Create BLoC files
        createFile(
          path.join(featurePath, 'presentation', 'bloc', `${camel}_bloc.dart`),
          generateBlocFile(pascal, camel)
        );

        createFile(
          path.join(featurePath, 'presentation', 'bloc', `${camel}_event.dart`),
          generateEventFile(pascal, camel)
        );

        createFile(
          path.join(featurePath, 'presentation', 'bloc', `${camel}_state.dart`),
          generateStateFile(pascal, camel)
        );

        // Domain layer
        createFile(
          path.join(featurePath, 'domain', 'entities', `${camel}.dart`),
          generateEntityFile(pascal)
        );

        createFile(
          path.join(featurePath, 'domain', 'repositories', `${camel}_repository.dart`),
          generateRepositoryFile(pascal, camel)
        );

        createFile(
          path.join(featurePath, 'domain', 'usecases', `${camel}_usecase.dart`),
          generateUsecaseFile(pascal, camel)
        );

        // Data layer
        createFile(
          path.join(featurePath, 'data', 'models', `${camel}_model.dart`),
          generateModelFile(pascal, camel)
        );

        createFile(
          path.join(featurePath, 'data', 'datasources', `${camel}_remote_datasource.dart`),
          generateDatasourceFile(pascal, camel)
        );

        createFile(
          path.join(featurePath, 'data', 'repositories', `${camel}_repository_impl.dart`),
          generateRepositoryImplFile(pascal, camel)
        );

        // Presentation layer
        createFile(
          path.join(featurePath, 'presentation', 'pages', `${camel}_page.dart`),
          generatePageFile(pascal, camel)
        );

        if (coreExists) {
          vscode.window.showInformationMessage(`✅ Feature '${featureName}' created successfully!`);
        } else {
          vscode.window.showInformationMessage(`✅ Project structure created with feature '${featureName}'!`);
        }

      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

function createCoreStructure(basePath: string) {
  const corePath = path.join(basePath, 'core');

  // Create core directories
  const coreDirs = [
    path.join(corePath, 'constants'),
    path.join(corePath, 'error'),
    path.join(corePath, 'network'),
    path.join(corePath, 'usecase'),
    path.join(corePath, 'utils'),
  ];

  coreDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Create core files only if they don't exist
  const apiConstantsPath = path.join(corePath, 'constants', 'api_constants.dart');
  if (!fs.existsSync(apiConstantsPath)) {
    createFile(apiConstantsPath, generateApiConstants());
  }

  const appConstantsPath = path.join(corePath, 'constants', 'app_constants.dart');
  if (!fs.existsSync(appConstantsPath)) {
    createFile(appConstantsPath, generateAppConstants());
  }

  const exceptionsPath = path.join(corePath, 'error', 'exceptions.dart');
  if (!fs.existsSync(exceptionsPath)) {
    createFile(exceptionsPath, generateExceptions());
  }

  const failuresPath = path.join(corePath, 'error', 'failures.dart');
  if (!fs.existsSync(failuresPath)) {
    createFile(failuresPath, generateFailures());
  }

  const networkInfoPath = path.join(corePath, 'network', 'network_info.dart');
  if (!fs.existsSync(networkInfoPath)) {
    createFile(networkInfoPath, generateNetworkInfo());
  }

  const usecasePath = path.join(corePath, 'usecase', 'usecase.dart');
  if (!fs.existsSync(usecasePath)) {
    createFile(usecasePath, generateUsecase());
  }

  const typedefsPath = path.join(corePath, 'utils', 'typedefs.dart');
  if (!fs.existsSync(typedefsPath)) {
    createFile(typedefsPath, generateTypedefs());
  }
}

function createFile(filePath: string, content: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

function toPascalCase(str: string): string {
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

// Core files generators
function generateApiConstants(): string {
  return `class ApiConstants {
  static const String baseUrl = 'https://api.example.com';
  static const String timeout = '30';
}
`;
}

function generateAppConstants(): string {
  return `class AppConstants {
  static const String appName = 'Flutter App';
  static const String appVersion = '1.0.0';
}
`;
}

function generateExceptions(): string {
  return `class ServerException implements Exception {
  final String message;
  ServerException({required this.message});
}

class CacheException implements Exception {
  final String message;
  CacheException({required this.message});
}

class NetworkException implements Exception {
  final String message;
  NetworkException({required this.message});
}
`;
}

function generateFailures(): string {
  return `import 'package:equatable/equatable.dart';

abstract class Failure extends Equatable {
  final String message;
  const Failure({required this.message});

  @override
  List<Object> get props => [message];
}

class ServerFailure extends Failure {
  const ServerFailure({required String message}) : super(message: message);
}

class NetworkFailure extends Failure {
  const NetworkFailure({required String message}) : super(message: message);
}

class CacheFailure extends Failure {
  const CacheFailure({required String message}) : super(message: message);
}
`;
}

function generateNetworkInfo(): string {
  return `abstract class NetworkInfo {
  Future<bool> get isConnected;
}

class NetworkInfoImpl implements NetworkInfo {
  @override
  Future<bool> get isConnected async {
    // TODO: Implement network connectivity check
    return true;
  }
}
`;
}

function generateUsecase(): string {
  return `import 'package:dartz/dartz.dart';
import '../error/failures.dart';

abstract class UseCase<Type, Params> {
  Future<Either<Failure, Type>> call(Params params);
}

class NoParams {
  @override
  bool operator ==(Object other) => identical(this, other);

  @override
  int get hashCode => runtimeType.hashCode;
}
`;
}

function generateTypedefs(): string {
  return `import 'package:dartz/dartz.dart';
import '../error/failures.dart';

typedef ResultFuture<T> = Future<Either<Failure, T>>;
typedef DataMap = Map<String, dynamic>;
`;
}

// Feature files generators
function generateBlocFile(pascal: string, camel: string): string {
  return `import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

part '${camel}_event.dart';
part '${camel}_state.dart';

class ${pascal}Bloc extends Bloc<${pascal}Event, ${pascal}State> {
  ${pascal}Bloc() : super(${pascal}Initial()) {
    on<${pascal}Event>((event, emit) {
      // TODO: implement event handler
    });
  }
}
`;
}

function generateEventFile(pascal: string, camel: string): string {
  return `part of '${camel}_bloc.dart';

sealed class ${pascal}Event extends Equatable {
  const ${pascal}Event();

  @override
  List<Object> get props => [];
}
`;
}

function generateStateFile(pascal: string, camel: string): string {
  return `part of '${camel}_bloc.dart';

sealed class ${pascal}State extends Equatable {
  const ${pascal}State();

  @override
  List<Object> get props => [];
}

final class ${pascal}Initial extends ${pascal}State {}
`;
}

function generateEntityFile(pascal: string): string {
  return `import 'package:equatable/equatable.dart';

class ${pascal} extends Equatable {
  final String id;
  final String name;

  const ${pascal}({
    required this.id,
    required this.name,
  });

  @override
  List<Object> get props => [id, name];
}
`;
}

function generateRepositoryFile(pascal: string, camel: string): string {
  return `import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/${camel}.dart';

abstract class ${pascal}Repository {
  Future<Either<Failure, ${pascal}>> get${pascal}();
}
`;
}

function generateUsecaseFile(pascal: string, camel: string): string {
  return `import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/${camel}.dart';
import '../repositories/${camel}_repository.dart';

class Get${pascal}UseCase extends UseCase<${pascal}, NoParams> {
  final ${pascal}Repository repository;

  Get${pascal}UseCase(this.repository);

  @override
  Future<Either<Failure, ${pascal}>> call(NoParams params) {
    return repository.get${pascal}();
  }
}
`;
}

function generateModelFile(pascal: string, camel: string): string {
  return `import '../../domain/entities/${camel}.dart';

class ${pascal}Model extends ${pascal} {
  const ${pascal}Model({
    required String id,
    required String name,
  }) : super(id: id, name: name);

  factory ${pascal}Model.fromJson(Map<String, dynamic> json) {
    return ${pascal}Model(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
    };
  }
}
`;
}

function generateDatasourceFile(pascal: string, camel: string): string {
  return `import '../models/${camel}_model.dart';

abstract class ${pascal}RemoteDataSource {
  Future<${pascal}Model> get${pascal}();
}

class ${pascal}RemoteDataSourceImpl implements ${pascal}RemoteDataSource {
  @override
  Future<${pascal}Model> get${pascal}() async {
    // TODO: Implement API call
    throw UnimplementedError();
  }
}
`;
}

function generateRepositoryImplFile(pascal: string, camel: string): string {
  return `import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../domain/repositories/${camel}_repository.dart';
import '../datasources/${camel}_remote_datasource.dart';
import '../models/${camel}_model.dart';

class ${pascal}RepositoryImpl implements ${pascal}Repository {
  final ${pascal}RemoteDataSource remoteDataSource;

  ${pascal}RepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, ${pascal}Model>> get${pascal}() async {
    try {
      final result = await remoteDataSource.get${pascal}();
      return Right(result);
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }
}
`;
}

function generatePageFile(pascal: string, camel: string): string {
  return `import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/${camel}_bloc.dart';

class ${pascal}Page extends StatelessWidget {
  const ${pascal}Page({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${pascal}')),
      body: BlocBuilder<${pascal}Bloc, ${pascal}State>(
        builder: (context, state) {
          return const Center(child: Text('${pascal} Page'));
        },
      ),
    );
  }
}
`;
}

export function deactivate() {}