'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters
let webcam;                     // Video holding element

//Оновлення значень у реальному часі
function updateControls() {
    //Отримуємо елементи
    const eyeSeparation = document.getElementById("eyeSeparation");
    const fov = document.getElementById("fov");
    const nearClip = document.getElementById("nearClip");
    const convergence = document.getElementById("convergence");

    //Додаємо обробники подій для повзунків
    eyeSeparation.addEventListener("input", () => {
        stereoCam.eyeSeparation = parseFloat(eyeSeparation.value);
        console.log("eyeSeparation: ", stereoCam.eyeSeparation)
        eyeSeparationValue.textContent = eyeSeparation.value;
        draw();
    });

    fov.addEventListener("input", () => {
        stereoCam.FOV = deg2rad(parseFloat(fov.value));
        console.log("fov: ", stereoCam.FOV, "rads")
        fovValue.textContent = fov.value;
        draw();
    });

    nearClip.addEventListener("input", () => {
        stereoCam.nearClippingDistance = parseFloat(nearClip.value);
        console.log("near: ", stereoCam.nearClippingDistance)
        nearClipValue.textContent = nearClip.value;
        draw();
    });

    convergence.addEventListener("input", () => {
        stereoCam.convergence = parseFloat(convergence.value);
        console.log("convergence: ", stereoCam.convergence)
        convergenceValue.textContent = convergence.value;
        draw();
    });
}

// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

/* 
 *  Draws
 */
function draw() { 
    //Колір чистого фону
    //Майже чорненький
    gl.clearColor(0.1, 0.15, 0.25, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let modelView = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    //Перший прохід (для лівого ока)
    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    let translateLeftEye = m4.translation(stereoCam.eyeSeparation / 2, 0, 0);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0);
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1);
    
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2);

    //Налаштування маски кольору для лівого ока (червоний канал)
    gl.colorMask(true, false, false, true);

    //Малюємо заповнені полігони (фон)
    gl.uniform4fv(shProgram.iColor, [1, 0, 0, 1]);
    surface.Draw();

    //Тепер вайрфрейм каркас поверх полігонів
    //Майже червоний
    gl.uniform4fv(shProgram.iColor, [0.5, 0, 0, 1]);
    surface.DrawWireframe();

    //Другий прохід (для правого ока)
    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4.translation(-stereoCam.eyeSeparation / 2, 0, 0);

    matAccum0 = m4.multiply(rotateToPointZero, modelView);
    matAccum1 = m4.multiply(translateRightEye, matAccum0);
    matAccum2 = m4.multiply(translateToPointZero, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2);

    //Налаштування маски кольору для правого ока (зелений + синій)
    gl.colorMask(false, true, true, true);

    // Малюємо заповнені полігони (фон)
    gl.uniform4fv(shProgram.iColor, [0, 1, 1, 1]);
    surface.Draw();

    //Тепер вайрфрейм каркас поверх полігонів
    //Майже червоний
    gl.uniform4fv(shProgram.iColor, [0, 0.5, 0.5, 1]); 
    surface.DrawWireframe();

    //Повертаємо маску кольору до нормального стану
    gl.colorMask(true, true, true, true);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    //Створення шейдерної програми
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    //Зв'язуємо графічний процесор з центральним для всього, що використовуємо
    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    let data = CreateSurfaceData();

    surface = new Model('RichmondSurface');
    surface.BufferData(data.verticesF32, data.indicesU16);

    stereoCam = new StereoCamera(
        .7,     // decimeters eyeSeparation
        14.0,   // decimeters convergence
        3,      // aspect ratio of canvas
        0.4,    // radians FOV
        8.0,    // decimeters nearClippingDistance
        20.0    // decimeters farClippingDistance
    );

    gl.enable(gl.DEPTH_TEST);

    updateControls();

    initWebcam();
}

/* Ініціалізація веб-камери */
function initWebcam() {
    webcam = document.getElementById("webcam");
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            webcam.srcObject = stream;
            webcam.play();
            webcam.style.position = "absolute";
            webcam.style.top = "10px";
            webcam.style.right = "10px";
            webcam.style.width = "300px";
            webcam.style.height = "200px";
            webcam.style.zIndex = "10";
        })
        .catch(err => {
            console.error("Error accessing webcam: ", err);
        });
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
//Тут беремо шейдери
//І віддаємо компілятору глсл
function createProgram(gl, vShader, fShader) {
    //Вертексний шейдер
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    //Фрагментний (піксельний) шейдер
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    //Додаємо до програми
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    //Шукаємо канвас
    //І контекст вебгл
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }

    //Ініціюєму гл і трекболротатор
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    //Починаємо малювати
    draw();
}