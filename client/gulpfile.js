/// <reference path="../typings/node/node.d.ts" />
var gulp = require('gulp'),
	path = require('path'),
	git = require('gulp-git'),
	msbuild = require('gulp-msbuild'),
	mstest = require('gulp-mstest'),
	// xslt = require('gulp-xslt'),
	yargs = require('yargs'),
	assemblyInfo = require('gulp-assemblyinfo'),
	runSequence = require('run-sequence'),
	merge = require('merge'),
	genTemplateString = require('./helpers.js').GenerateTemplateString;

yargs.options({
	b: {
		alias: 'branch',
		describe: 'The branch to use (e.g. -b develop)',
		requiresArg: true,
		type: 'string'
	},
	M: {
		alias: 'majorVersion',
		describe: 'The major version of the product (e.g. -M 4)',
		requiresArg: true,
	},
	m: {
		alias: 'minorVersion',
		describe: 'The minor version of the product (e.g. -m 12)',
		requiresArg: true,
	},
	d: {
		alias: 'buildDate',
		describe: 'The build date of the product (e.g. -d 8/25/2015)',
		requiresArg: true,
		default: new Date(Date.now()).toLocaleDateString()
	},
	r: {
		alias: 'revision',
		describe: 'The revision to list in the product version (e.g. -r 8771)',
		requiresArg: true,
		type: 'string'
	},
	p: {
		alias: 'product',
		describe: 'The product being build (e.g. -p MyProduct)',
		requiresArg: true,
		type: 'string',
		demand: true
	},
	n: {
		alias: 'companyName',
		describe: 'The name of the company releasing the product (e.g. -cn MyCompany)',
		requiresArg: true
	},
	c: {
		alias: 'buildConfig',
		describe: 'The configuration the product should build in (e.g. -bc Debug)',
		requiresArg: true
	},
	u: {
		alias: 'buildRevision',
		describe: 'The revision from which to build the product (e.g. -r HEAD)',
		requiresArg: true
	},
	y: {
		alias: 'checkoutRoot',
		describe: 'The root location of all product checkouts (e.g. -cf D:/Git System Repositories)',
		requiresArg: true
	},
	j: {
		alias: 'projectCheckout',
		describe: 'The location of the project specific checkout (e.g. -pc D:/Git System Repositories/Project)',
		requiresArg: true
	},
	o: {
		alias: 'projectPath',
		describe: 'The location of the project file for the product (e.g. -pp D:/Git System Repositories/Project/Project.csproj)',
		requiresArg: true
	},
	i: {
		alias: 'solutionDir',
		describe: 'The location of the solution file (e.g. -sd D:/Git System Repositories/Project/Solutions)',
		requiresArg: true
	},
	s: {
		alias: 'solution',
		describe: 'The location of the solution file for the product (e.g. -s D:/Git System Repositories/Project/Solutions/Solution.sln',
		requiresArg: true
	},
	t: {
		alias: 'tests',
		describe: 'Locations to look for tests. Supports glob searches.',
		requiresArg: true,
		type: 'array'
	},
	l: {
		alias: 'configLocation',
		describe: 'The location of the config file that specifies build config options. Follows the convention ./{product}/{product}.json if not specified',
		requiresArg: true,
		type: 'string'
	},
	f: {
		alias: 'publishStepLocation',
		describe: 'The location of the publish steps that should be run when deploying the application. Follows the convention ./{product}/{product}.js if not specified',
		requiresArg: true,
		type: 'string'
	}
});

// Setup usages
yargs.help('help');
yargs.implies('f', 'l');

// Setup valid commands for this gulpfile
yargs.command('log', 'Log the options that were provided');
yargs.command('git-reset', 'Reset the git checkout. Requires -u, -j');
yargs.command('git-checkout', 'Checkout a specific branch. Requires -b, -j');
yargs.command('git-fetch', 'Fetch all updates from the remote. Requires -b, -j');
yargs.command('git-pull', 'Fetch and merge all updates from the remote. Requires -b');
yargs.command('update-assembly', 'Update the version info for assemblies in the checkout. Requires -u, -n, -M, -m, -d, -r');
yargs.command('config-transform', 'Performs a transformation on the config file for the product. Requires -c');
yargs.command('msbuild', 'Builds the provided solution. Requires -s, -c');
yargs.command('mstest', 'Runs the tests in the given libraries. Requires -t');
yargs.command('publish', 'Runs the publish commands for deploying the product.');
yargs.command('default', 'Runs git-reset, git-checkout, git-fetch, update-assembly, config-transform, msbuild, mstest, and publish sequentially in that order.');

yargs.example('gulp msbuild -p MyProduct', "Follows the convention based setup of having the config file in a folder matching the product name");
yargs.example('gulp publish -p MyProduct -f "C:\\MyProduct\\Build\\publish.js" -l "C:\\MyProduct\\Build\\config.json"', "Publishes the built product and explicitly specifies where to look for the config an publish location");

var config;
var finishingPieces;
yargs.check((args, options) => {
	var configLocation = args.configLocation || `./${args.product}/${args.product}.json`;
	var publishLocation = args.publishStepLocation || `./${args.product}/${args.product}.js`;
	 
	config = require(configLocation);
	finishingPieces = require(publishLocation);
	
	return !!finishingPieces.Publish && (args.publishStepLocation ? !!args.configLocation : true);
});

var args = yargs.argv;

var options = merge.recursive(true, config, args);

options.projectCheckout = args.projectCheckout || config.projectCheckout || path.join(options.checkoutRoot, options.product);
if(options.projectCheckout.includes('${'))
	options.projectCheckout = genTemplateString(options.projectCheckout, options);
	
options.projectPath = args.projectPath || config.projectPath || path.join(options.projectCheckout, options.product);
if(options.projectPath.includes('${'))
	options.projectPath = genTemplateString(options.projectPath, options);
	
options.solutionDir =  args.solutionDir || config.solutionDir || path.join(options.projectCheckout, "Solutions");
if(options.solutionDir.includes('${'))
	options.solutionDir = genTemplateString(options.solutionDir, options);
	
options.solution = args.solution || config.solution || path.join(options.solutionDir, options.product + '.sln');
if(options.solution.includes('${'))
	options.solution = genTemplateString(options.solution, options);

Object.freeze(options);

gulp.task('log', () => {
	console.log(options);
});

gulp.task('git-reset', cb => {
	git.reset(options.buildRevision, { args: '--hard', cwd: options.projectCheckout }, cb);
});

gulp.task('git-clean', cb => {
	git.clean({ cwd: options.projectCheckout, args: '-f' }, cb);
});

gulp.task('git-checkout', cb => {
	git.checkout(options.branch, { cwd: options.projectCheckout }, cb);
});

gulp.task('git-fetch', cb => {
	git.fetch('origin', options.branch, { cwd: options.projectCheckout }, cb);
});

gulp.task('git-pull', cb => {
	git.pull('origin', options.branch, {args: '--tags'}, cb);
});


gulp.task('update-assembly', cb => {
	git.revParse({ args: `--short ${options.buildRevision}` }, (err, hash) => {
		if(err)
			return cb(err);
		
		var rev = hash.substr(-4);
		var revNum = parseInt(rev, 16);
		
		var stream = gulp.src(['**/AssemblyInfo.cs'], { base: '.' })
		.pipe(assemblyInfo({
			outputFile: '*',
			language: 'cs',
			companyName: options.companyName,
			product: options.product,
			version: `${options.majorVersion}.${options.minorVersion}.${revNum}.${options.buildDate}`
		}))
		.pipe(gulp.dest('./'));
		
		stream.on('finish', function() {
			cb();
		});
	});
});

gulp.task('config-transform', cb => {
// 	return gulp.src(path.join(projectPath, 'App.config'), { base: '.' })
// 	.pipe(xslt('App.' + buildConfig + '.config', {
		
// 	}))
// 	.pipe(gulp.dest('./'));
	cb();
});

gulp.task('msbuild', () => {
	return gulp.src([options.solution])
	.pipe(msbuild({
		errorOnFail: true,
		logCommand: true,
		configuration: options.buildConfig
	}));
});

gulp.task('mstest', () => {
	return gulp.src(['**/*.Tests.dll'])
	.pipe(mstest({
		outputEachResult: false,
		outputFinalCount: false,
		quitOnFailed: true,
		errorMessage: true,
		errorStackTrace: false
	}));
});

gulp.task('publish', cb => {
	finishingPieces.Publish(options, cb);
});

gulp.task('default', cb => {
	return runSequence('git-reset', 'git-clean', 'git-checkout', 'git-fetch', 'update-assembly', 'config-transform', 'msbuild', 'mstest', 'publish', cb);
});
