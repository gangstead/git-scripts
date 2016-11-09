#!/usr/bin/env node
'use strict';

const _ = require('lodash');
const B = require('bluebird');
const yarp = require('yarp');

const program = require('commander');

program
  .description('Create sims after devices are created')
  .option('--token [token]', 'github oauth or personal access token')
  .parse(process.argv);

if (!program.token) {
  program.help();
}

const github = 'https://api.github.com';
const ghHeaders = {
  accept: 'application/vnd.github.v3+json',
  authorization: `token ${program.token}`,
  'User-Agent': 'gangstead-script'
};

const followLinks = (resp) => {
  const repos = resp.data;
  const links = _.get(resp, 'headers.link', '').split(',');
  const nextLink = _.find(links, (l) => l.includes('rel="next"'));
  if (nextLink) {
    return yarp({
      method: 'GET',
      url: /<(.*)>/.exec(nextLink)[1],  // ie get the URL from `'<https://api.github.com/...&page=2>; rel="next"`
      headers: ghHeaders
    }, true)
      .then((resp2) => followLinks(resp2))
      .then((repos2) => _.concat(repos, repos2));
  }
  return B.resolve(repos);
};

const displaySortedRepos = (url, qs) => B.resolve()
  .then(() => console.log(`Repos for ${url}`))
  .then(() =>
    yarp({
      method: 'GET',
      url: `${github}/${url}`,
      headers: ghHeaders,
      qs
    }, true)
  )
  .then(followLinks)
  .then((repos) =>
    _(repos)
      .map((r) => _.pick(r, [ 'full_name', 'created_at' ]))
      .sortBy('created_at')
      .value()
  )
  .then((resp) => console.log(
    'Repos:\n',
    _.map(resp, (r) => `${r.created_at}   ${r.full_name}`),
    '\nTotal:',
    resp.length
  ));

B.resolve()
.then(() => displaySortedRepos('users/gangstead/repos', { type: 'all' }))
.catch((err) => {
  console.log('Failed with err ', err);
})
.done();
