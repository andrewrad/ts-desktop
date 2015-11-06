;(function () {
    'use strict';

    var _ = require('lodash'),
        puts = console.log.bind(console);

    function zipper (r) {
        return r.length ? _.map(r[0].values, _.zipObject.bind(_, r[0].columns)) : [];
    }

    function go (module, fn) {
        var args = [].slice.call(arguments, 2),
            f = module ? module[fn] : fn;

        return new Promise(function (resolve, reject) {
          f.apply(module, args.concat(function (err, data) {
            return err ? reject(err) : resolve(data);
          }));
        });
    }

    /**
     *  var pm = ProjectsManager(db);
     *
     *  e.g. var pm = App.projectsManager;
     */

    function ProjectsManager(db) {

        var query = db.exec.bind(db);

        return {
            /**
             *  var l = pm.targetLanguages,
             *      africanLangs = _.filter(l, 'region', 'Africa'),
             *      europeanLangs = _.filter(l, 'region', 'Europe'),
             *      en = _.find(l, 'lc', 'en');
             */

            get targetLanguages () {
                var r = query("select id, slug 'lc', name 'ln', direction, region from target_language order by slug");
                return zipper(r);
            },

            /**
             *  var projects = pm.getProjects('en');
             *
             *  Defaults to English ('en'). This is equivalent:
             *    var projects = pm.getProjects();
             *
             *  var grouped = _.groupBy(projects, 'category'),
             *      partitioned = _.partition(projects, 'category');
             */

            getProjects: function (lang) {
                var r = query([
                        "select p.id, p.slug, sl.project_name 'name', sl.project_description 'desc', c.category_name 'category' from project p",
                        "join source_language sl on sl.project_id=p.id",
                        "left join source_language__category c on c.source_language_id=sl.id",
                        "where sl.slug='" + (lang || 'en') + "'",
                        "order by p.sort"
                    ].join(' '));
                return zipper(r);
            },

            /**
             *  var sources = pm.sources,
             *      englishSources = _.filter(sources, 'lc', 'en'),
             *      arabicSources = _.filter(sources, 'lc', 'ar');
             */

            get sources () {
                var r = query([
                        "select r.id, r.slug, r.name, sl.name 'ln', sl.slug 'lc', r.checking_level, r.version from resource r",
                        "join source_language sl on sl.id=r.source_language_id",
                        "order by r.name"
                    ].join(' '));
                return zipper(r);
            },

            /**
             *  var frames = pm.getSourceFrames('1ch', 'udb'),
             *      groupedByChapter = _(frames).groupBy('chapter').values().sortBy('0.chapter').value();
             *
             *  var getFrames = pm.getSourceFrames.bind(null, '1ch'),
             *      s1 = getFrames('udb'),
             *      s2 = getFrames('ulb');
             */

            getSourceFrames: function (project, source) {
                var r = query([
                        "select f.id, f.body 'chunk', c.slug 'chapter' from frame f",
                        "join chapter c on c.id=f.chapter_id",
                        "join resource r on r.id=c.resource_id",
                        "join source_language sl on sl.id=r.source_language_id",
                        "join project p on p.id=sl.project_id where p.slug='" + project + "' and r.slug='" + source + "'",
                        "order by c.id, f.sort"
                    ].join(' '));

                return zipper(r);
            },

            saveTargetTranslation: function (translation) {
                return go(null, 'mkdirp', 'dirpath').then(function () {
                    return go(fs, 'writeFile', 'filepath', JSON.stringify(translation));
                }).catch(puts);
            },

            loadTargetTranslationsList: function () {
                var isUW = _.partialRight(_.startsWith, 'uw-', 0);

                return go(fs, 'readDir', 'dirpath').then(function (files) {
                    return _.filter(files, isUW);
                }).catch(puts);
            },

            loadTargetTranslation: function (translation) {
                return go(fs, 'readFile', 'filepath').then(puts).catch(puts);
            }
        };
    }

    module.exports.ProjectsManager = ProjectsManager;

})();