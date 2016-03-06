var fs = require('fs');
var JSONStream = require('JSONStream');
var es = require('event-stream');

exports.registerMigrator = function (hexo) {
  hexo.extend.migrator.register('ghost', function (args, callback) {
    var source = args._.shift();

    if (!source) {
      var help = [
        'Usage: hexo migrate ghost <ghost_ouput_json>',
        '',
        'For more help, you can check https://hexo.io/docs/migration.html'
      ];

      console.log(help.join('\n'));
      return callback();
    }

    var log = hexo.log;
    var post = hexo.post;
    var posts = [];
    var fixYaml = new RegExp('[\"|\'|\&]', 'g');

    var srcEv = fs.createReadStream(source)
    .pipe(JSONStream.parse(['db', true, 'data', 'posts', true]))
    .pipe(es.mapSync(data => {
      if (data.title
      && data.created_at
      && data.markdown
      && data.status === 'published') {
        if (data.title.match(fixYaml)) {
          log.i(data.title + 'invalid in yaml, need fixed');
        }

        var newPost = {
          title: data.title.replace(fixYaml, '') || data.slug,
          date: new Date(data.created_at),
          content: data.markdown,
          slug: data.slug
        };

        log.i(`Create post - ${data.title}`);
        post.create(newPost);
      } else {
        log.i('ERROR - Incorrect post format', JSON.stringify(data));
      }
    }));

    srcEv.on('end', function() {
      log.i('Finish import ghost posts');
      callback();
    });
  });
}
