import { join } from 'path';

import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import { HostTree } from '@angular-devkit/schematics';
import { getFileContent } from '@schematics/angular/utility/test';

import { isInModuleMetadata } from '../test-utils';
import { Schema as ApplicationOptions } from '../ng-new/shared/schema';
import { Schema as ModuleOptions } from '../generate/module/schema';
import { Schema as ComponentOptions } from '../generate/component/schema';
import { moveToRoot, getSourceFile } from '../utils';
import { Schema as MigrateComponentOptions } from './schema';
import { findImports } from '../ast-utils';

describe('Migrate component schematic', () => {
    const project = 'some-project';
    const componentName = 'a';
    const moduleName = 'b';
    const componentClassName = 'AComponent';

    const schematicRunner = new SchematicTestRunner(
        'nativescript-schematics',
        join(__dirname, '../collection.json')
    );

    let appTree: UnitTestTree;
    beforeEach(() => {
        appTree = new UnitTestTree(new HostTree());
        appTree = setupProject(appTree, schematicRunner, project);
    });

    describe('When the name of existing component is provided', () => {
        const componentName = 'a';
        const options: MigrateComponentOptions = {
            project,
            name: componentName,
            style: true
        };
        const htmlComponentPath = `/src/app/${componentName}/${componentName}.component.html`;
        const xmlComponentPath = `/src/app/${componentName}/${componentName}.component.tns.html`;

        beforeEach(async () => {
            appTree = await schematicRunner.runSchematicAsync('component', <ComponentOptions>{
                name: componentName,
                nativescript: false,
                web: true,
                project,
            }, appTree)
            .toPromise();
            appTree = schematicRunner.runSchematic('migrate-component', options, appTree);
        });

        it('should create an {N} markup file for the component', () => {
            expect(appTree.files).toContain(xmlComponentPath);
        });

        it('should declare the component in the correct NgModule', () => {
            const nsModulePath = `/src/app/app.module.tns.ts`;
            const content = getFileContent(appTree, nsModulePath);

            const matcher = isInModuleMetadata('AppModule', 'declarations', componentClassName, true);
            expect(content).toMatch(matcher);
        });

        it('should import the component in the correct NgModule using @src', () => {
            const nsModulePath = `/src/app/app.module.tns.ts`;
            const source = getSourceFile(appTree, nsModulePath);
            const imports = findImports(componentClassName, source);

            expect(imports.length).toEqual(1);
            expect(imports[0].getFullText()).toContain(`@src/app/${componentName}/${componentName}.component`)
        });

        it('should put the original web template in the {N} markup file', () => {
            const html = getFileContent(appTree, htmlComponentPath);
            const xml = getFileContent(appTree, xmlComponentPath);

            expect(xml.includes(html)).toBeTruthy();
        });
    });

    describe('When component imported in another module is provided', () => {

        const options: MigrateComponentOptions = {
            project,
            name: componentName,
            module: moduleName,
            style: true
        };
        const htmlComponentPath = `/src/app/${componentName}/${componentName}.component.html`;
        const xmlComponentPath = `/src/app/${componentName}/${componentName}.component.tns.html`;

        beforeEach(async () => {
            appTree = await schematicRunner.runSchematicAsync('module', <ModuleOptions>{
                project,
                name: moduleName,
            }, appTree)
            .toPromise();

            appTree = await schematicRunner.runSchematicAsync('component', <ComponentOptions>{
                project,
                nativescript: false,
                web: true,
                name: componentName,
                module: moduleName,
            }, appTree)
            .toPromise();

            appTree = schematicRunner.runSchematic('migrate-component', { ...options }, appTree);

        });

        it('should create an {N} markup file for the component', () => {
            expect(appTree.files).toContain(xmlComponentPath);
        });

        it('should declare the component in the correct NgModule', () => {
            const nsModulePath = `/src/app/${moduleName}/${moduleName}.module.tns.ts`;
            const content = getFileContent(appTree, nsModulePath);

            const matcher = isInModuleMetadata("BModule", 'declarations', componentClassName, true);
            expect(content).toMatch(matcher);
        });

        it('should import the component in the correct NgModule using @src', () => {
            const nsModulePath = `/src/app/${moduleName}/${moduleName}.module.tns.ts`;
            const source = getSourceFile(appTree, nsModulePath);
            const imports = findImports(componentClassName, source);

            expect(imports.length).toEqual(1);
            expect(imports[0].getFullText()).toContain(`@src/app/${componentName}/${componentName}.component`)
        });

        it('should put the original web template in the {N} markup file', () => {
            const html = getFileContent(appTree, htmlComponentPath);
            const xml = getFileContent(appTree, xmlComponentPath);

            expect(xml.includes(html)).toBeTruthy();
        });
    });
});

const setupProject = (
    appTree: UnitTestTree,
    schematicRunner: SchematicTestRunner,
    project: string,
) => {
    appTree = schematicRunner.runSchematic('shared', <ApplicationOptions>{
        name: project,
        prefix: '',
        sourceDir: 'src',
        style: 'css',
        theme: true,
        sample: false,
    }, appTree);

    appTree = moveToRoot<UnitTestTree>(schematicRunner, appTree, project);

    return appTree;
};
