var fs = require('fs');
var JSONStream = require('JSONStream');
var es = require('event-stream');

var tagsList = {};
var mapPostToTag = {};

function loadMeta(src, callback) {
  var log = hexo.log;
  var waiting = false;

  var tagSrc = fs.createReadStream(src)
  .pipe(JSONStream.parse(['db', true, 'data', 'tags', true]))
  .pipe(es.mapSync(data => {
    tagsList[data.id] = {
      name: data.name,
      slug: data.slug
    };
  }));

  var mapSrc = fs.createReadStream(src)
  .pipe(JSONStream.parse(['db', true, 'data', 'posts_tags', true]))
  .pipe(es.mapSync(data => {
    if (!mapPostToTag[data.post_id]) {
      mapPostToTag[data.post_id] = [];
    }

    mapPostToTag[data.post_id].push(data.tag_id);
  }));

  tagSrc.on('end', (ev) => {
    log.i('tag data are finish');
    if (waiting) { return callback() };
    waiting = true;
  });

  mapSrc.on('end', () => {
    log.i('post to tag are finish');
    if (waiting) { return callback() };
    waiting = true;
  });
}

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

  log.i('Ready to import ghost posts');
  loadMeta((source),  () => {
    log.i('Load import metadata...');
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

          var tags = [];
          if (mapPostToTag[data.id] && Array.isArray(mapPostToTag[data.id])) {
            mapPostToTag[data.id].forEach(item => {
              if (tagsList[item]) tags.push(tagsList[item]['name']);
            });
            log.i(`${newPost.title} has tags - ${tags.join(',')}`);
          }
          if (tags.length > 0) { newPost.tags = tags; }

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

});
