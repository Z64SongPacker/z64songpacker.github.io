---
title: Z64 Song Packer | Why use Github? How does it work?
---

If you didn't know, the Z64 Song Packer uses GitHub as a platform to host 

GitHub is a platform that hosts repositories.
A repository is a container of files, specially dedicated to code.

But why do we store files here, if it's for code. It has multiple benefits.

- Allows versioning: you can practically go back in time and check files from ages ago; very hard to lose files.
- Allows automation: you can setup workflows that allows to execute code inside; ideal for sanitization and integration with other platforms (like Discord).
- Allows approving: not anyone can upload, so files can be checked for quality control.

The trade-off is that using this platform has a learning curve, for both submitters and approvers.



How adding/updating files work 

Changes made to a repo are called "commits". A commit stores only the changes made in a specific instance. This allows multiple people to make changes at the same time, and for repository owners to have full control of what changes are made.

A repository can contains thousands of commits, and together they form a "history". That's what allows us to go back in time.

Only the repository owner (or people they have given the proper permission) can commit directly to a repository. That protects it from damage.

But, with that in mind, how can people external of the repository add files to it?


Forks and pull requests

Yes, only people with permission can modify a repository. But given that it's public, anyone can make a personal copy of it, and made any changes they want over there, without affecting the original repo. Those copy repositories are called "forks".

Since the forks is a different repository, in can be desynced from the original.

If the fork doesn't have all the commits the original has, then it's "behind". Is very easy to sync a fork with the upstream.

If the fork has commits that the original doesn't have, then it's "ahead". At this point is when "pull requests" enter the picture.

A pull request is a process that the owner of a fork can start. It's pretty much saying to the original repo: "Hey, I have commits you don't have, can you please pull them to your repo?"

This system allows people outside of the repo to contribute safely.
But how are those changes integrated?

Approval and merge

A pull request contains a title, a description, a list of changes, and a thread of comments so both parties can comunicate about the request.

The submitter can explain what these changes are, and why they should be included in the main repository. 

The approvers (who are contributors with push permission on the repository) can see all this information, and decide wheter to accept or reject the pull request.

If the 