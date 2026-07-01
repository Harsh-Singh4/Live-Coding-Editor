app.post("/run-code", async (req, res) => {

    const { code, language, userId } = req.body;

    if (!allowRunCode(userId)) {
        return res.status(429).json({
            output: "Rate limit exceeded"
        });
    }



    try {

        const response = await fetch(
            "https://api.hackerearth.com/v4/partner/code-evaluation/submissions/",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "client-secret":
                        process.env.HACKEREARTH_SECRET
                },
                body: JSON.stringify({
                    source: code,
                    lang: langMap[language],
                    input: "",
                    time_limit: 5,
                    memory_limit: 262144
                })
            }
        );

        const data =
            await response.json();

        const statusUrl =
            data.status_update_url;

        let result;

        while (true) {

            const statusResponse =
                await fetch(
                    statusUrl,
                    {
                        headers: {
                            "client-secret":
                                process.env.HACKEREARTH_SECRET
                        }
                    }
                );

            result =
                await statusResponse.json();
            console.log({
                request:
                    result.request_status.code,

                compile:
                    result.result?.compile_status,

                run:
                    result.result?.run_status?.status
            });
            if (
                result.request_status.code ===
                "REQUEST_COMPLETED"
            ) {
                break;
            }

            await new Promise(
                r => setTimeout(r, 2000)
            );
        }
        const outputUrl =
            result.result.run_status.output;

        const outputResponse =
            await fetch(outputUrl);

        const output =
            await outputResponse.text();

        res.json({
            output
        });
    }
    catch (err) {

        res.json({
            output: err.message
        });

    }

});











const runCode = async () => {

    setLoading(true);
    setOutput("");

    try {

        const res = await fetch(
            "http://localhost:3000/run-code",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                    "application/json"
                },
                body: JSON.stringify({
                    code,
                    language,
                    userId
                })
            }
        );


if (res.status === 429) {
    const data = await res.json();
    setOutput(data.output);
    return;
}


        const data =
        await res.json();

        console.log(data);


        setOutput(data.output);

    } catch(err){

        setOutput(
            "Execution failed"
        );

    } finally {

        setLoading(false);

    }
};