type Issue = { issueNumber: number, title: string, description: string, comments: { user: string, body: string }[], nlp: any }

async function getGithubIssue(index: number): Promise<any> {
    try {
        const response = await fetch('https://api.github.com/repos/hackclub/hcb/issues/' + index, {
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
                'X-GitHub-Api-Version': '2022-11-28'
            }
        }).then((res) => res.json())

        const comments = await fetch('https://api.github.com/repos/hackclub/hcb/issues/' + index + '/comments', {
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
                'X-GitHub-Api-Version': '2022-11-28'
            }
        }).then((res) => res.json())

        return {
            title: response.title,
            description: response.body,
            comments: comments.map((comment: any) => ({ user: comment.user.login, body: comment.body })),
        }
    } catch (e) {
        console.error(e)
        return { failed: true }
    }
}

async function processBlock() {
    const issueStart = Number(await prompt('Enter the issue number to start from: '));
    const issueEnd = Number(await prompt('Enter the issue number to end at: '));

    let problematicIssues: Issue[] = [];

    for (let i = issueStart; i <= issueEnd; i++) {
        const issue = await getGithubIssue(i);
        if (issue.failed) {
            console.log(`Issue ${i} failed to fetch!`);
            // wait for 5 seconds before trying again
            await new Promise((resolve) => setTimeout(resolve, 5000));
            i--;
            continue;
        }

        // send the issue to the NLP model as a text string
        const nlp = await (await fetch('http://127.0.0.1:5000/scan', {
            method: 'POST',
            body: JSON.stringify({ data: issue.title + '\n' + issue.description + '\n' + issue.comments.map((comment: { body: any }) => comment.body).join('\n') }),
            headers: {
                'Content-Type': 'application/json',
            },
        })).json();

        if (Object.keys(nlp).length === 0) {
            console.log(`Issue ${i} is clean!`);
            console.log(`Progress: ${Math.round((i - issueStart) / (issueEnd - issueStart) * 100)}%`);
            continue;
        } else {
            console.log(`Issue ${i} is problematic!`);
            problematicIssues.push({
                issueNumber: i,
                ...issue,
                nlp: nlp,
            });
        }

        // display a progress bar
        console.log(`Progress: ${Math.round((i - issueStart) / (issueEnd - issueStart) * 100)}%`);
    }

    return problematicIssues;
}

// page trough issues and ask if they are problematic
async function checkSafe(processedIssues: Issue[]) {
    console.log('Checking problematic issues...');
    console.log(`Total problematic issues: ${processedIssues.length}`);
    console.log('---');
    for (const issue of processedIssues) {
        console.log(`Issue ${issue.issueNumber} is problematic!`);
        console.log(`Title: ${issue.title}`);
        console.log(`Description: ${issue.description}`);
        console.log(`Comments: \n${issue.comments.map((comment) => `${comment.user}: ${comment.body}`).join('\n---\n')}`);
        console.log(`NLP: ${JSON.stringify(issue.nlp)}`);

        const safe = await prompt('Is this issue safe? (y/n): ');
        if (safe?.toLowerCase() === 'y') {
            console.log(`Issue ${issue.issueNumber} is safe!\n\n\n\n\n`);
        } else {
            console.log(`Issue ${issue.issueNumber} is not safe!`);
        }
    }
}

const processed = await processBlock();
console.log('Processed all issues!');
await checkSafe(processed);
