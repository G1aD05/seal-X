#!/usr/bin/env python3
"""
push_in_batches.py - push a huge project to GitHub a chunk at a time.

Instead of one giant commit/push (which GitHub rejects), this script:
  1. finds every file that isn't committed yet (respecting .gitignore),
  2. groups them into batches limited by total size and file count,
  3. for each batch: git add -> git commit -> git push (with retries).

It is resumable: if it stops for any reason, just run it again. Files from
finished batches are already committed, so only the remaining ones are batched.

Usage:
  python push_in_batches.py                      # current folder
  python push_in_batches.py path/to/project --remote https://github.com/you/repo.git
  python push_in_batches.py --max-mb 300 --max-files 1000
  python push_in_batches.py --dry-run            # show the plan, change nothing

Requires: Python 3.8+, git 2.25+.
"""
import argparse
import os
import subprocess
import sys
import time

MB = 1024 * 1024


def git(repo, args, input_bytes=None, check=True, stream=False):
    """Run a git command inside `repo`."""
    return subprocess.run(
        ["git", "-C", repo] + args,
        input=input_bytes,
        stdout=None if stream else subprocess.PIPE,
        stderr=None if stream else subprocess.PIPE,
        check=check,
    )


def out(repo, args):
    return git(repo, args).stdout.decode("utf-8", "replace").strip()


def has_commits(repo):
    return git(repo, ["rev-parse", "--verify", "-q", "HEAD"], check=False).returncode == 0


def pending_files(repo):
    """Untracked (not ignored) + modified + deleted files, as repo-relative paths."""
    raw = git(
        repo, ["ls-files", "-z", "--others", "--modified", "--deleted", "--exclude-standard"]
    ).stdout
    return sorted({p for p in raw.decode("utf-8", "surrogateescape").split("\0") if p})


def file_size(repo, rel):
    try:
        return os.lstat(os.path.join(repo, rel)).st_size
    except OSError:
        return 0  # deleted file


def make_batches(repo, files, max_bytes, max_files):
    batches, cur, cur_bytes = [], [], 0
    for rel in files:
        size = file_size(repo, rel)
        if cur and (cur_bytes + size > max_bytes or len(cur) >= max_files):
            batches.append((cur, cur_bytes))
            cur, cur_bytes = [], 0
        cur.append(rel)
        cur_bytes += size
    if cur:
        batches.append((cur, cur_bytes))
    return batches


def push(repo, branch, retries):
    cmd = ["-c", "http.postBuffer=524288000", "push", "-u", "origin", f"HEAD:refs/heads/{branch}"]
    for attempt in range(1, retries + 1):
        if git(repo, cmd, check=False, stream=True).returncode == 0:
            return True
        if attempt < retries:
            wait = min(120, 10 * attempt)
            print(f"  push failed (attempt {attempt}/{retries}); retrying in {wait}s...")
            time.sleep(wait)
    return False


def unpushed_commit_count(repo):
    if not has_commits(repo):
        return 0
    r = git(repo, ["rev-list", "--count", "HEAD", "--not", "--remotes=origin"], check=False)
    return int(r.stdout.decode().strip() or 0) if r.returncode == 0 else 0


def unpushed_bytes(repo):
    """Uncompressed size of all objects in local commits that aren't on origin."""
    objs = git(repo, ["rev-list", "--objects", "HEAD", "--not", "--remotes=origin"]).stdout
    shas = b"".join(l.split(b" ")[0] + b"\n" for l in objs.splitlines())
    r = git(repo, ["cat-file", "--batch-check=%(objectsize)"], input_bytes=shas)
    return sum(int(x) for x in r.stdout.split())


def undo_unpushed(repo):
    """Drop local unpushed commits but keep every file in the working folder."""
    oldest = out(repo, ["rev-list", "HEAD", "--not", "--remotes=origin"]).splitlines()[-1]
    if git(repo, ["rev-parse", "-q", "--verify", oldest + "^"], check=False).returncode == 0:
        git(repo, ["reset", "-q", "--mixed", oldest + "^"])
    else:  # the unpushed commit is the very first commit
        git(repo, ["update-ref", "-d", "HEAD"])
        git(repo, ["read-tree", "--empty"])


def fmt(n):
    return f"{n / MB:,.1f} MB"


def main():
    ap = argparse.ArgumentParser(description="Push a big project to GitHub in batches.")
    ap.add_argument("path", nargs="?", default=".", help="project folder (default: .)")
    ap.add_argument("--remote", help="GitHub URL to set as 'origin' if not set already")
    ap.add_argument("--branch", help="branch to push to (default: current branch, or main)")
    ap.add_argument("--max-mb", type=float, default=500, help="max size per batch in MB (default 500)")
    ap.add_argument("--max-files", type=int, default=2000, help="max files per batch (default 2000)")
    ap.add_argument("--file-limit-mb", type=float, default=100,
                    help="skip single files larger than this (GitHub's hard limit is 100)")
    ap.add_argument("--retries", type=int, default=4, help="push attempts per batch (default 4)")
    ap.add_argument("--undo-local-commits", action="store_true",
                    help="drop local commits that aren't on GitHub yet (files are kept) and re-batch them")
    ap.add_argument("--max-unpushed-mb", type=float, default=1500, help=argparse.SUPPRESS)
    ap.add_argument("--dry-run", action="store_true", help="show the plan only")
    a = ap.parse_args()

    repo = os.path.abspath(a.path)
    if not os.path.isdir(repo):
        sys.exit(f"Not a folder: {repo}")

    # --- make sure it's a repo with a remote ---------------------------------
    if git(repo, ["rev-parse", "--git-dir"], check=False).returncode != 0:
        if a.dry_run:
            sys.exit("Not a git repository yet (run without --dry-run to create one).")
        print("Not a git repo yet - running git init")
        git(repo, ["init"])
    remotes = out(repo, ["remote"]).split()
    if "origin" not in remotes:
        if not a.remote:
            sys.exit("No 'origin' remote. Re-run with --remote https://github.com/you/repo.git")
        git(repo, ["remote", "add", "origin", a.remote])
    elif a.remote:
        git(repo, ["remote", "set-url", "origin", a.remote])

    branch = a.branch
    if not branch:
        r = git(repo, ["symbolic-ref", "--short", "-q", "HEAD"], check=False)
        branch = r.stdout.decode().strip() or "main"
    if not has_commits(repo):
        git(repo, ["checkout", "-B", branch], check=False)

    # --- deal with commits that exist locally but never made it to GitHub -----
    ahead = unpushed_commit_count(repo)
    if ahead:
        size = unpushed_bytes(repo)
        too_large = size > a.max_unpushed_mb * MB
        if a.undo_local_commits or too_large:
            if not a.undo_local_commits:
                sys.exit(
                    f"\n{ahead} local commit(s) ({fmt(size)}) were never pushed and are too big for "
                    "GitHub in one push.\nRe-run with --undo-local-commits to drop those commits "
                    "(your files are kept) and push them in batches instead."
                )
            if a.dry_run:
                print(f"[dry run] would undo {ahead} local commit(s) ({fmt(size)}), keeping your files")
            else:
                print(f"Undoing {ahead} unpushed local commit(s) ({fmt(size)}); your files are kept.")
                undo_unpushed(repo)
        elif not a.dry_run:
            print(f"{ahead} local commit(s) not on GitHub yet - pushing those first...")
            if not push(repo, branch, a.retries):
                sys.exit("\nPush failed. If that commit is too big, re-run with --undo-local-commits.")

    # files staged by an earlier attempt would get swept into batch 1 - unstage them
    if not a.dry_run and git(repo, ["diff", "--cached", "--quiet"], check=False).returncode != 0:
        print("Unstaging files left staged by an earlier attempt (nothing is deleted)...")
        git(repo, ["reset", "-q"])

    # --- plan ------------------------------------------------------------------
    limit = int(a.file_limit_mb * MB)
    files = pending_files(repo)
    too_big = [f for f in files if file_size(repo, f) > limit]
    big = set(too_big)
    files = [f for f in files if f not in big]
    batches = make_batches(repo, files, int(a.max_mb * MB), a.max_files)

    if too_big:
        log = os.path.join(repo, ".git", "skipped_large_files.txt")
        with open(log, "w", encoding="utf-8") as fh:
            fh.write("\n".join(too_big) + "\n")
        print(f"\n! Skipping {len(too_big)} file(s) over {a.file_limit_mb:g} MB "
              f"(GitHub rejects these). List saved to {log}")
        for f in too_big[:10]:
            print(f"    {fmt(file_size(repo, f)):>12}  {f}")
        if len(too_big) > 10:
            print(f"    ... and {len(too_big) - 10} more")
        print("  Put them in .gitignore or use Git LFS (git lfs track), then re-run.\n")

    total = sum(b for _, b in batches)
    print(f"{len(files)} file(s), {fmt(total)} -> {len(batches)} batch(es) "
          f"(<= {a.max_mb:g} MB / {a.max_files} files each) -> origin/{branch}")
    if not batches:
        print("Nothing left to push.")
        return
    if a.dry_run:
        for i, (fl, nbytes) in enumerate(batches, 1):
            print(f"  batch {i}: {len(fl)} files, {fmt(nbytes)}")
        return

    # --- do it ------------------------------------------------------------------
    start = time.time()
    for i, (fl, nbytes) in enumerate(batches, 1):
        print(f"\n[{i}/{len(batches)}] {len(fl)} files, {fmt(nbytes)}")
        payload = ("\0".join(fl) + "\0").encode("utf-8", "surrogateescape")
        git(repo, ["add", "--pathspec-from-file=-", "--pathspec-file-nul"], input_bytes=payload)
        c = git(repo, ["commit", "-q", "-m", f"Add files (batch {i}/{len(batches)})"], check=False)
        if c.returncode != 0:
            msg = (c.stdout + c.stderr).decode("utf-8", "replace").strip()
            if "nothing to commit" in msg:
                print("  nothing to commit, skipping")
                continue
            sys.exit(f"git commit failed:\n{msg}")
        if not push(repo, branch, a.retries):
            sys.exit(
                f"\nBatch {i} is committed locally but the push failed. Check your connection / "
                "credentials, then run the script again - it will resume."
            )
        print(f"  pushed. elapsed {time.time() - start:,.0f}s")

    print("\nDone - everything is on GitHub.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nInterrupted - run again to resume.")
    except subprocess.CalledProcessError as e:
        err = (e.stderr or b"").decode("utf-8", "replace").strip()
        sys.exit(f"git error: {' '.join(e.cmd[:6])}...\n{err}")
