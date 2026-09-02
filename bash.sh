  $ cd ~/.gnupg
  $ gpg --export-ownertrust >otrust.lst
  $ mv pubring.gpg publickeys.backup
  $ gpg --import-options restore --import publickeys.backup
  $ gpg --import-ownertrust otrust.lst
  
