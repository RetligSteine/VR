'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let cameraSurface;              // A surface model for camera
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

let surfaceWebCam;              // A substrate for webcam image
let iTextureWebCam = -1;        // Camera texture
let video;  

//Дані трикутників і фігури
let trianglesData = {};
let data = {};

//Дані акселерометра
//Variants 1, 7, 13, [19], 25
//Implement surface rotation based on hardware accelerometer sensor readings. 
//As the accelerometer provides a single vector a tilting only orientation is possible.
let wsurl = "ws://192.168.0.101:8080/sensor/connect?type=android.sensor.accelerometer"
//WebSocket
let ws
let accelerometerdata

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
        eyeSeparationValue.textContent = eyeSeparation.value;
    });

    fov.addEventListener("input", () => {
        stereoCam.FOV = deg2rad(parseFloat(fov.value));
        fovValue.textContent = fov.value;
    });

    nearClip.addEventListener("input", () => {
        stereoCam.nearClippingDistance = parseFloat(nearClip.value);
        nearClipValue.textContent = nearClip.value;
    });

    convergence.addEventListener("input", () => {
        stereoCam.convergence = parseFloat(convergence.value);
        convergenceValue.textContent = convergence.value;
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
    // Location of the uniform matrix representing the model view matrix.
    this.iModelViewMatrix = -1;
    // Location of the uniform matrix representing the projection matrix.
    this.iProjectionMatrix = -1;
    // Координати текстури
    this.iAttribTexCoord = -1; 
    // Текстура
    this.iTexture = -1;
    //Чи треба використовувати текстуру
    this.iUseTexture = -1;


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
    //console.log(JSON.parse(wsdata).values);

    gl.clearColor(0.1, 0.15, 0.25, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    //Кольори
    const colorPolygon = new Float32Array([0.25,0.5,0.75,1]);
    const colorEdge    = new Float32Array([1,1,1,1]);

    // PATH ZERO: DRAW ZERO PARALLAX WEBCAM
    gl.activeTexture(gl.TEXTURE0);
    //Оновлюємо текстуру
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video); 

    //Матриця ортогональної проекції для поверхні
    //(left, right, bottom, top, near, far, dst)
    let matrOrth = m4.orthographic(-1, 1, -1, 1, -1, 1);

    //Відмалювання поверхні веб-камери
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrOrth);
    //Використовуємо одиничну матрицю для ModelView
    let identityMatrix = m4.identity();
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, identityMatrix); 

    //Буферизація даних
    cameraSurface.BufferData(trianglesData.verticesF32, trianglesData.indicesU16, trianglesData.texCoordsF32);
    //Увімкнути текстуру
    gl.uniform1i(shProgram.iUseTexture, 1); 

    //Малюємо cameraSurface як полігони
    gl.colorMask(true, true, true, true);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    cameraSurface.Draw();
    
    //Тепер нам не потрібні текстурні координати
    gl.disableVertexAttribArray(shProgram.iAttribTexCoord);
    
    //Вимкнути текстуру для інших об’єктів
    gl.uniform1i(shProgram.iUseTexture, 0);



    //Дані для малювання поверхні
    surface.BufferData(data.verticesF32, data.indicesU16);

    //Дані з акселерометра
    const ax = accelerometerdata[0]; //прискорення по осі X
    const ay = accelerometerdata[1]; //прискорення по осі Y
    const az = accelerometerdata[2]; //прискорення по осі Z

    //Нормалізуємо дані вектора для стабільності
    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
    const nx = ax / magnitude;
    const ny = ay / magnitude;
    const nz = az / magnitude;

    //Обчислюємо кути нахилу (roll та pitch)
    //Обертання навколо осі X
    const roll = Math.atan2(ny, nz);
    //Обертання навколо осі Y
    const pitch = Math.atan2(-nx, Math.sqrt(ny * ny + nz * nz));

    //Створюємо матриці обертання
    let rotationX = m4.xRotation(roll);
    let rotationY = m4.yRotation(pitch);
    let tiltRotation = m4.multiply(rotationX, rotationY);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    //Комбінуємо обертання від акселерометра з базовим обертанням
    let baseRotation = m4.multiply(rotateToPointZero, modelView);
    let combinedRotation = m4.multiply(tiltRotation, baseRotation);

    // The FIRST PASS (for the left eye)
    //Очищаємо буфер глибини
    gl.clear(gl.DEPTH_BUFFER_BIT);
    //Це ProjectionMatrix для лівого ока
    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);
    //Для лівого ока - мінус, для правого - плюс
    let translateLeftEye = m4. translation(-stereoCam.eyeSeparation/2, 0, 0);
    //modelViewMatrix для лівого ока
    let matAccum0 = m4.multiply(rotateToPointZero, combinedRotation );
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0 );
    let modelViewMatrix = m4.multiply(translateToPointZero, matAccum1 );
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewMatrix );

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1,0);
    //Для лівого ока - лише червоний компонент     
    gl.colorMask(true, false, false, true);
    //Колір для полігонів
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();
    //Колір вайрфрейму
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // The SECOND PASS (for the right eye)
    //Очищаємо буфер глибини
    gl.clear(gl.DEPTH_BUFFER_BIT);
    //Це ProjectionMatrix для правого ока
    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);
    //Для лівого ока - мінус, для правого - плюс
    let translateRightEye = m4. translation(stereoCam.eyeSeparation/2, 0, 0);
    //modelViewMatrix для правого ока
    matAccum0 = m4.multiply(rotateToPointZero, combinedRotation );
    matAccum1 = m4.multiply(translateRightEye, matAccum0 );
    modelViewMatrix = m4.multiply(translateToPointZero, matAccum1 );
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewMatrix );

    //Для правого ока - зелений і синій компоненти     
    gl.colorMask(false, true, true, true);
    //Колір полігонів
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();
    //Колір вайрфрейму
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    //Очищуємо параметри до їхнього стандартного стану
    gl.disable(gl.POLYGON_OFFSET_FILL);
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

    shProgram.iAttribTexCoord           = gl.getAttribLocation(prog, "texCoord");
    shProgram.iTexture                  = gl.getUniformLocation(prog, "u_texture");
    shProgram.iUseTexture               = gl.getUniformLocation(prog, "useTexture");

    stereoCam = new StereoCamera(
        .2,     // decimeters eyeSeparation
        14.0,   // decimeters convergence
        1.6,      // aspect ratio of canvas
        0.45,    // radians FOV
        8.0,    // decimeters nearClippingDistance
        20.0    // decimeters farClippingDistance
    );

    //Створюємо поверхню яку відобразимо
    CreateSurfaceData(data)
    surface = new Model('RichmondSurface');

    //Геометрія для двох трикутників (прямокутника для веб-камери)
    trianglesData.verticesF32 = new Float32Array([
        -1.0, -1.0, 0.0,  //Нижній лівий кут
         1.0, -1.0, 0.0,  //Нижній правий кут
         1.0,  1.0, 0.0,  //Верхній правий кут
        -1.0,  1.0, 0.0   //Верхній лівий кут
    ]);
    trianglesData.indicesU16 = new Uint16Array([
        0, 1, 2,  //Перший трикутник
        0, 2, 3   //Другий трикутник
    ]);
    trianglesData.texCoordsF32 = new Float32Array([ // Окремий масив для текстурних координат
        0.0, 1.0,  // Нижній лівий
        1.0, 1.0,  // Нижній правий
        1.0, 0.0,  // Верхній правий
        0.0, 0.0   // Верхній лівий
    ]);

    //Створюмєо поверхню для текстури (2 трикутника)
    cameraSurface = new Model('Surface for camera');
    gl.enable(gl.DEPTH_TEST);

    //Оновлення управління
    updateControls();
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
    //WebSocket
    ws = new WebSocket(wsurl);
    ws.addEventListener("open", (event) => {
        console.log("WebSocket working!");
    });
    ws.addEventListener("message", (event) => {
        accelerometerdata = JSON.parse(event.data).values;
    });

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

    video = document.createElement('video');
    video.autoplay = true;

    //Під'єднання до вебкамери
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        iTextureWebCam = CreateWebCamTexture(settings.width, settings.height);
        
        video.play();
    }  )
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    }
    );

    //Відмальовка кожні 1/20 секунди
    setInterval(draw, 1/20);
    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}
