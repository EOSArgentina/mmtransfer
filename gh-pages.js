import { publish } from 'gh-pages';

publish(
 'build', // path to public directory
 {
  branch: 'gh-pages',
  repo: 'https://github.com/EOSArgentina/mmtransfer.git',
  dotfiles: true
  },
  () => {
   console.log('Deploy Complete!');
  }
);