/* global Cypress */
/// <reference types="cypress" />

import webpack, { Compiler, compilation, Plugin } from 'webpack'
import { EventEmitter } from 'events'
import _ from 'lodash'
import semver from 'semver'
import fs, { PathLike } from 'fs'
import path from 'path'

type UtimesSync = (path: PathLike, atime: string | number | Date, mtime: string | number | Date) => void

interface CypressOptions {
  files: Cypress.Cypress['spec'][]
  projectRoot: string
  devServerEvents?: EventEmitter
  support: string
}

interface CypressCTWebpackContext extends compilation.Compilation {
  _cypress: CypressOptions
}

export default class CypressCTOptionsPlugin implements Plugin {
  private files: Cypress.Cypress['spec'][] = []
  private readonly projectRoot: string
  private readonly devServerEvents: EventEmitter
  private support: string

  constructor (options: CypressOptions) {
    this.files = options.files
    this.projectRoot = options.projectRoot
    this.devServerEvents = options.devServerEvents
    this.support = options.support
  }

  private pluginFunc = (context: CypressCTWebpackContext, module: compilation.Module) => {
    context._cypress = {
      files: this.files,
      projectRoot: this.projectRoot,
      support: this.support,
    }
  };

  /**
   *
   * @param compilation webpack 4 `compilation.Compilation`, webpack 5
   *   `Compilation`
   */
  private plugin = (compilation: compilation.Compilation) => {
    this.devServerEvents.on('dev-server:specs:changed', (specs) => {
      if (_.isEqual(specs, this.files)) return

      this.files = specs
      const inputFileSystem = compilation.inputFileSystem
      const utimesSync: UtimesSync = semver.gt('4.0.0', webpack.version) ? inputFileSystem.fileSystem.utimesSync : fs.utimesSync

      utimesSync(path.resolve(__dirname, 'browser.js'), new Date(), new Date())
    })

    // Webpack 5
    /* istanbul ignore next */
    if ('NormalModule' in webpack) {
      // @ts-ignore
      webpack.NormalModule.getCompilationHooks(compilation).loader.tap(
        'CypressCTOptionsPlugin',
        this.pluginFunc,
      )

      return
    }

    // Webpack 4
    compilation.hooks.normalModuleLoader.tap(
      'CypressCTOptionsPlugin',
      this.pluginFunc,
    )
  };

  apply (compiler: Compiler): void {
    compiler.hooks.compilation.tap('CypressCTOptionsPlugin', this.plugin)
  }
}
