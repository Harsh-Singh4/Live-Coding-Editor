import redis from "./redis.js";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const langMap = {
    cpp: "CPP17",
    python: "PYTHON3",
    javascript: "JAVASCRIPT_NODE",
    java: "JAVA8"
};

while (true) {

    const job = await redis.blPop(
        "codeQueue",
        0
    );

    const data = JSON.parse(
        job.element
    );

    try {

        console.log("JOB RECEIVED");
        console.log(data);

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
                    source: data.code,
                    lang: langMap[data.language],
                    input: "",
                    time_limit: 5,
                    memory_limit: 262144
                })
            }
        );

        const submitData =
            await response.json();

            console.log(submitData);

        const statusUrl =
            submitData.status_update_url;

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

const compileStatus =
    result.result?.compile_status;

if (
    compileStatus &&
    compileStatus !== "OK" &&
    compileStatus !== "Compiling..."
) {
    break;
}
            
            if (
                result.request_status.code ===
                "REQUEST_COMPLETED"
            ) {
                break;
            }

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        2000
                    )
            );
        }


        let output = "";

if (
    result.result?.compile_status &&
    result.result.compile_status !== "OK"
) {

        output = compileStatus;

}
else {

       const runStatus =
    result.result.run_status.status;


if (runStatus === "OLE") {

    output =
        "Output Limit Exceeded";

}
else if (runStatus === "TLE") {

    output =
        "Time Limit Exceeded";

}
else if (runStatus === "RE") {

    output =
        "Runtime Error";

}
else {

    const outputUrl =
        result.result.run_status.output;

    if (!outputUrl) {

        output =
            "No output available";

    }
    else {

        const outputResponse =
            await fetch(outputUrl);

        output =
            await outputResponse.text();

    }

}
}

        await fetch(
            `${process.env.BACKEND_URL}/job-complete`,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    roomId:
                        data.roomId,

                    output
                })
            }
        );

        console.log(
            "RESULT SENT"
        );

    }
    catch (err) {

        console.log(err);

        await fetch(
            `${process.env.BACKEND_URL}/job-complete`,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    roomId:
                        data.roomId,

                    output:
                        err.message
                })
            }
        );

    }

}