# feedback.js
Feedback tool similar to Google's.

### Installing

```
npm i @davidlinc1/feedback.js
```

### Usage

Import and create an instance of `Feedback`:
```ts
import { Feedback } from '@davidlinc1/feedback.js';
.
.
.
const feedback = new Feedback();
feedback.open();
```

At the moment only two functions are exposed: `open` and `close`, although the latter shouldn't be needed.

Import the stylesheet:

```scss
@import "~@davidlinc1/feedback.js/dist/lib/feedback.css";
```

There are two optional parameters, `FeedbackOptions` and `HTML2CanvasOptions`.

Currently, the only options supported by `FeedbackOptions` are:

`endpoint`: The url where you want to post the form data. The data will be sent as `json`:

```json
{
  "description": "some text",
  "screenshot": "base64 png"
}
```

`allowedTags` _(optional)_: A string array containing the name of the nodes you want to be able to be highlighted on mouseover.

You can read about `HTML2CanvasOptions` here: http://html2canvas.hertzen.com/configuration.

### Build instructions

    # Install (dev) dependencies
    npm install