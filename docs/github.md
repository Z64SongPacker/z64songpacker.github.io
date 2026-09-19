---
title: Z64 Song Packer - Why use Github? How does it work?
---

# Why use Github? How does it work?

If you didn't know, the Z64 Song Packer uses **GitHub** as a back-end. 

GitHub is a platform that hosts repositories.
A repository is a container of files, **specially dedicated to code**.

But why do we store files here if it's for code? It has ***multiple benefits***:

- **Allows versioning**: you can practically go back in time and check files from ages ago; very hard to lose files.
- **Allows automation**: you can setup workflows that execute code inside when events happen; ideal for sanitization and integration with other platforms (like Discord).
- **Allows approving**: not anyone can upload, so files can be checked for quality control.

The trade-off is that using this platform has a learning curve, for both submitters and approvers.

## How adding/updating files work 

Changes made to a repo are called **commits**. A commit stores only the changes made in a specific moment of time. This allows multiple people to make changes at the same time and for repository owners to have full control of what changes are made.

A repository can contains *thousands* of commits, and together they form a **history**.

Only the repository owner (or people they have given the proper permission, called **collaborators**) can commit directly to a repository. That protects it from damage.

But, with that in mind, how can people external of the repository add files to it?

## Forks

Given that these repositories are public, *anyone* can make a *personal copy* and make any changes they want over there without affecting the original repo. Those copy repositories are called **forks**.

Since the fork is a different repository, in can be desynced from the original.

If the fork doesn't have all the commits the original has, then it's **behind**.

But if the fork has commits that the original doesn't have, then it's **ahead**. Is at this point is when **pull requests** enter the picture.

## Pull requests

A pull request is a process that a fork owner of can start. It's pretty much saying to the original repo:

> "Hey, I have commits you don't have, can you please pull them to your repo?"

No changes are made to the original without authorization. This system allows people outside of the repo to contribute safely.

But how are those changes integrated?

## Approval and merge

A pull request contains a title, a description, a list of changes, and a thread of comments so both parties can comunicate about the request.

The submitter can explain what these changes are, and why they should be included in the main repository. 

The **approvers** (who are collaborators of the original repo) can see all this information, and decide wheter to *accept* or *reject* the pull request.

If the pull request is accepted, then those changes are integrated to the original!

## The GitHub's rabbit hole

These are pretty much the basics of it.

I know this may sound intimidating, but that's why the packer itself and the submission form exists. They do all of this stuff behind the scenes for you!

The rabbit hole goes ***much, much deeper***, but you don't need to know everything all at once right now.

> If you want more info, please check the official documentation of GitHub for these topics:
>
> https://docs.github.com/en/pull-requests/reference/commits
> https://docs.github.com/en/pull-requests/reference/forks
> https://docs.github.com/en/pull-requests/reference/pull-requests
