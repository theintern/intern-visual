/* jshint node:true */
var fs = require('fs');

var TASKS = [
	'grunt-contrib-clean',
	'grunt-contrib-copy',
	'grunt-contrib-watch',
	'grunt-contrib-jshint',
	'grunt-contrib-stylus',
	'grunt-shell',
	'grunt-jscs',
	'grunt-text-replace',
	'grunt-tslint',
	'intern'
];

var LIBS = [
	'node_modules/dojo-loader/loader.min.js'
];

var LIBINFO = LIBS.map(function (file) {
	var stats = fs.statSync(file);
	return {
		file: file,
		stats: stats,
		mainDirectory: /^node_modules\/([^/]*)/.exec(file)[1],
		libFilename: stats.isDirectory() ? '' : file.substr(file.lastIndexOf('/') + 1)
	};
});

function createCopyConfiguration(target) {
	return LIBINFO.map(function (info) {
		if (info.stats.isDirectory()) {
			return {
				expand: true,
				cwd: info.file,
				src: '*',
				dest: target + info.mainDirectory
			};
		}
		return {
			src: info.file,
			dest: target + info.mainDirectory + '/' + info.libFilename
		};
	});
}

function createSymlinkConfiguration(target) {
	return LIBINFO.map(function (info) {
		return {
			src: info.file,
			dest: target + info.mainDirectory + '/' + info.libFilename
		};
	});
}

function mixin(destination, source) {
	for (var key in source) {
		destination[key] = source[key];
	}
	return destination;
}

function formatGlob(tsconfigGlob) {
	return tsconfigGlob.map(function (glob) {
		if (/^\.\//.test(glob)) {
			// Remove the leading './' from the glob because grunt-ts
			// sees it and thinks it needs to create a .baseDir.ts which
			// messes up the "dist" compilation
			return glob.slice(2);
		}
		return glob;
	});
}

module.exports = function (grunt) {
	TASKS.forEach(grunt.loadNpmTasks.bind(grunt));

	// Parse some information from tsconfig.json for the grunt configuration
	var tsconfigContent = grunt.file.read('tsconfig.json');
	var tsconfig = JSON.parse(tsconfigContent);

	var tsconfigDistContent = grunt.file.read('tsconfig.dist.json');
	var tsconfigDist = JSON.parse(tsconfigDistContent);

	tsconfig.include = formatGlob(tsconfig.include);
	tsconfigDist.include = formatGlob(tsconfigDist.include);

	// parse some information from package.json for grunt
	var packageJson = grunt.file.readJSON('package.json');

	grunt.initConfig({
		name: packageJson.name,
		version: packageJson.version,
		tsconfig: tsconfig,
		tsconfigDist: tsconfigDist,
		istanbulIgnoreNext: '/* istanbul ignore next */',
		filesGlob: tsconfig.include,
		all: [ '<%= filesGlob %>' ],
		skipTests: [ '<%= all %>', '!tests/**/*.ts' ],
		staticTestFiles: 'tests/**/*.{html,css}',
		srcDirectory: 'src',
		siteDirectory: '.',
		devDirectory: '<%= tsconfig.compilerOptions.outDir %>',
		distDirectory: '<%= tsconfigDist.compilerOptions.outDir %>',
		testDirectory: 'test',
		/**
		 * The target directory is used to target either the devDirectory or distDirectory depending on the
		 * the `settarget` task.
		 */
		targetDirectory: '<%= devDirectory %>',

		clean: {
			dist: {
				src: [ '<%= distDirectory %>/' ]
			},
			dev: {
				src: [ '<%= devDirectory %>' ]
			},
			src: {
				src: [ '{src,tests}/**/*.js' ],
				filter: function (path) {
					// Only clean the .js file if a .js.map file also exists
					var mapPath = path + '.map';
					if (grunt.file.exists(mapPath)) {
						grunt.file.delete(mapPath);
						return true;
					}
					return false;
				}
			},
			coverage: {
				src: [ 'html-report/' ]
			},
			visualTest: {
				src: [ 'visual-test/' ]
			}
		},

		copy: {
			libs: {
				files: createCopyConfiguration('<%= distDirectory %>/libs/')
			},
			nodeModules: {
				expand: true,
				cwd: '.',
				src: [ 'node_modules/**/*' ],
				dest: '<%= distDirectory %>'
			},
			staticTestFiles: {
				expand: true,
				cwd: '.',
				src: [ '<%= staticTestFiles %>' ],
				dest: '<%= devDirectory %>'
			},
			staticDistFiles: {
				expand: true,
				cwd: '.',
				src: [ 'README.md', 'LICENSE.txt', 'package.json' ],
				dest: '<%= distDirectory %>'
			},
			tsDefinitions: {
				expand: true,
				cwd: '.',
				src: [ '<%= srcDirectory %>/**/*.d.ts' ],
				dest: '<%= targetDirectory %>'
			}
		},

		stylus: {
			compile: {
				files: {
					'<%= targetDirectory %>/src/reporters/util/assets/main.css': 'src/reporters/util/assets/main.styl'
				}
			}
		},

		intern: {
			options: {
				runType: 'runner',
				config: '<%= devDirectory %>/tests/intern'
			},
			all: {
				options: {
					reporters: [ 'Runner', { id: 'LcovHtml', directory: 'html-report' } ]
				}
			},
			client: {
				options: {
					runType: 'client',
					reporters: [ 'Console', { id: 'LcovHtml', directory: 'html-report' } ]
				}
			},
			self: {
				options: {
					reporters: [
						'Runner',
						{ id: 'src/reporters/VisualRegression' }
					]
				}
			},
			ci: {
				options: {
					config: '<%= devDirectory %>/tests/intern.ci',
					reporters: [ 'Runner', { id: 'LcovHtml', directory: 'html-report' } ]
				}
			},
			proxy: {
				options: {
					proxyOnly: true
				}
			}
		},

		rename: {
			sourceMaps: {
				expand: true,
				cwd: '<%= distDirectory %>',
				src: [ '**/*.js.map', '!_debug/**/*.js.map' ],
				dest: '<%= distDirectory %>/_debug/'
			}
		},

		rewriteSourceMaps: {
			dist: {
				src: [ '<%= distDirectory %>/_debug/**/*.js.map' ]
			}
		},

		replace: {
			addIstanbulIgnore: {
				src: [ '<%= devDirectory %>/**/*.js' ],
				overwrite: true,
				replacements: [
					{
						from: /^(var __(?:extends|decorate) = )/gm,
						to: '$1<%= istanbulIgnoreNext %> '
					},
					{
						from: /^(\()(function \(deps, )/m,
						to: '$1<%= istanbulIgnoreNext %> $2'
					}
				]
			}
		},

		shell: {
			dev: {
				command: 'tsc'
			},
			dist: {
				command: 'tsc --project tsconfig.dist.json'
			},
			test: {
				command: 'tsc --project tsconfig.js.json'
			}
		},

		tslint: {
			options: {
				configuration: 'tslint.json'
			},
			src: {
				src: [
					'<%= all %>',
					'!typings/**/*.ts',
					'!tests/typings/**/*.ts'
				]
			}
		},

		jshint: {
			all: [ 'Gruntfile.js', '<%= srcDirectory %>/**/*.js', '<%= testDirectory %>/**/*.js' ]
		},

		jscs: {
			all: [ 'Gruntfile.js', '<%= srcDirectory %>/**/*.js', '<%= testDirectory %>/**/*.js' ]
		},

		watch: {
			grunt: {
				options: {
					reload: true
				},
				files: [ 'Gruntfile.js', 'tsconfig.json', 'typings.json' ]
			},
			src: {
				options: {
					atBegin: true
				},
				files: [ '<%= all %>', '<%= staticTestFiles %>' ],
				tasks: [
					'build-quick'
				]
			}
		}
	});

	/**
	 * Set some Intern-specific options if specified on the command line.
	 */
	[ 'suites', 'functionalSuites', 'grep' ].forEach(function (option) {
		var value = grunt.option(option);
		if (value) {
			if (option !== 'grep') {
				value = value.split(',').map(function (string) {
					return string.trim();
				});
			}
			grunt.config('intern.options.' + option, value);
		}
	});

	/**
	 * Rename (move) a collection of files
	 */
	grunt.registerMultiTask('rename', function () {
		this.files.forEach(function (file) {
			if (grunt.file.isFile(file.src[0])) {
				grunt.file.mkdir(require('path').dirname(file.dest));
			}
			require('fs').renameSync(file.src[0], file.dest);
			grunt.verbose.writeln('Renamed ' + file.src[0] + ' to ' + file.dest);
		});
		grunt.log.writeln('Moved ' + this.files.length + ' files');
	});

	/**
	 * Set the 'targetDirectory' property based on the target
	 * a grunt parameter of 'dist' will change the 'targetDirectory' to equal the 'distDirectory'; all other
	 * parameters will keep the 'targetDirectory' the same ('devDirectory')
	 */
	grunt.registerTask('settarget', function (target) {
		var directory = grunt.config.get('targetDirectory');
		if (target === 'dist') {
			directory = grunt.config.get('distDirectory');
		}
		console.log('Setting targetDirectory to ' + target + ': ' + directory);
		grunt.config.set('targetDirectory', directory);
	});

	/**
	 * Perform a minimum, complete build
	 */
	grunt.registerTask('build-quick', [
		'shell:dev'
	]);

	/**
	 * Dev build
	 */
	grunt.registerTask('build', [
		'shell:dev',
		'stylus',
		'copy:staticTestFiles'/*,
		'replace:addIstanbulIgnore'*/
	]);

	/**
	 * Create a distro
	 */
	grunt.registerTask('dist', [
		'settarget:dist',
		'clean:dist',
		'shell:dist',
		'stylus',
		'copy:staticDistFiles',
		'copy:tsDefinitions',
		'copy:libs',
		'shell:test'
	]);

	grunt.registerTask('lint', [ 'jshint', 'jscs', 'tslint' ]);
	grunt.registerTask('test', [ 'clean', 'build', 'intern:all' ]);
	grunt.registerTask('test-quick', [ 'build', 'intern:client' ]);
	grunt.registerTask('test-ci', [ 'clean', 'lint', 'build', 'intern:ci', 'dist' ]);
	grunt.registerTask('test-self', [ 'clean', 'lint', 'build', 'intern:self' ]);
	grunt.registerTask('default', [ 'clean', 'lint', 'build' ]);
};
