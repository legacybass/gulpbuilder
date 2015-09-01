/* global path */
var gulp = require('gulp'),
	git = require('gulp-git'),
	msbuild = require('gulp-msbuild'),
	mstest = require('gulp-mstest'),
	// xslt = require('gulp-xslt'),
	yargs = require('yargs'),
	assemblyInfo = require('gulp-assemblyinfo'),
	config = require('./gulpConfig.json'),
	runSequence = require('run-sequence');
	
	
// Setup aliases for CLI args
yargs.alias('b', 'branch')
	.alias('M', 'majorVersion')
	.alias('m', 'minorVersion')
	.alias('bd', 'buildDate')
	.alias('r', 'revision')
	.alias('p', 'product')
	.alias('cn', 'companyName')
	.alias('bc', 'buildConfig')
	.alias('br', 'buildRevision')
	.alias('cr', 'checkoutRoot')
	.alias('pc', 'projectCheckout')
	.alias('pp', 'projectPath')
	.alias('sd', 'solutionDir')
	.alias('s', 'solution')
	
	.usage('Usage: \n' +
		'\t(-b | branch): the branch to use (e.g. -b develop)\n' +
		'\t(-M | majorVersion): the major version of the product (e.g. -M 4)\n' +
		'\t(-m | minorVersion): the minor version of the product (e.g. -m 12)\n' +
		'\t(-bd | buildDate): the build date of the product (e.g. -bd 8/25/2015)\n' +
		'\t(-r | revision): the revision to list in the product version (e.g. -r 8771)\n' +
		'\t(-p | product): the product being build (e.g. -p Ignition)\n' +
		'\t(-cn | companyName): the name of the company releasing the product (e.g. -cn Powerteq)\n' +
		'\t(-bc | buildConfig): the configuration the product should build in (e.g. -bc Debug)\n' +
		'\t(-br | buildRevision): the revision from which to build the product (e.g. -r HEAD)\n' +
		'\t(-cr | checkoutRoot): the root location of all product checkouts (e.g. -cf D:/Git System Repositories)\n' +
		'\t(-pc | projectCheckout): the location of the project specific checkout (e.g. -pc D:/Git System Repositories/Project)\n' +
		'\t(-pp | projectPath): the location of the project file for the product (e.g. -pp D:/Git System Repositories/Project/Project.csproj)\n' +
		'\t(-sd | solutionDir): the location of the solution file (e.g. -sd D:/Git System Repositories/Project/Solutions)\n' +
		'\t(-s | solution): the location of the solution file for the product (e.g. -s D:/Git System Repositories/Project/SOlutions/Solution.sln)')
		
	.demand(['p']);

var args = yargs.argv;

// Variables
var branch = args.branch || config.branch,
	
	majorVersion = args.majorVersion || config.majorVersion,
	minorVersion = args.minorVersion || config.minorVersion,
	buildDate = args.buildDate || new Date(Date.now()),
	revision = args.revision || config.revision,
	
	product = args.product,
	companyName = args.companyName || config.companyName,
	buildConfig = args.buildConfig || config.buildConfig,
	buildRevision = args.buildRevision || config.buildRevision,
	
	checkoutRoot = args.checkoutRoot || 'D:\\Git Build System Repositories',
	projectCheckout = args.projectCheckout || path.join(checkoutRoot, product),
	projectPath = args.projectPath || path.join(projectCheckout, product),
	solutionDir = args.solutionDir || path.join(projectCheckout, "Solutions"),
	solution = args.solution || path.join(solutionDir, product + '.sln');

	
gulp.task('git-reset', function (cb) {
	git.reset('--hard', function (err) {
		cb(err);
	});
});

gulp.task('git-checkout', function (cb) {
	git.checkout(branch, function (err) {
		cb(err);
	});
});

gulp.task('git-pull', function (cb) {
	git.pull('origin', branch, {args: '--tags'}, function (err) {
		cb(err);
	});
});


gulp.task('update-assembly', function (cb) {
	git.revParse({ args: '--short ' + revision }, function (err, hash) {
		if(err)
			return cb(err);
		
		var rev = hash.substr(-4);
		var revNum = parseInt(rev, 16);
		
		var stream = gulp.src(['**/AssemblyInfo.cs'], { base: '.' })
		.pipe(assemblyInfo({
			outputFile: '*',
			language: 'cs',
			companyName: companyName,
			product: product,
			version: majorVersion + '.' + minorVersion + '.' + revNum + '.' + buildDate
		}))
		.pipe(gulp.dest('./'));
		
		stream.on('finish', function() {
			cb();
		});
	});
	
	
});

gulp.task('config-transform', function (cb) {
// 	return gulp.src(path.join(projectPath, 'App.config'), { base: '.' })
// 	.pipe(xslt('App.' + buildConfig + '.config', {
		
// 	}))
// 	.pipe(gulp.dest('./'));
	cb()
});

gulp.task('msbuild', function () {
	return gulp.src([solution])
	.pipe(msbuild({
		errorOnFail: true,
		logCommand: true,
		configuration: buildConfig
	}));
});

gulp.task('mstest', ['msbuild'], function () {
	return gulp.src(['**/*.Tests.dll'])
	.pipe(mstest({
		outputEachResult: false,
		outputFinalCount: false,
		quitOnFailed: true,
		errorMessage: true,
		errorStackTrace: false
	}));
});

gulp.task('publish', function (cb) {
	// TODO: publish things
	cb();
});

gulp.task('default', function (cb) {
	return runSequence('git-reset', 'git-checkout', 'git-pull', 'update-assembly', 'config-transform', 'msbuild', 'mstest', 'publish', cb);
});
