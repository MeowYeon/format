# preserves standard Markdown and Obsidian syntax

## 输入
````text
# title
## title
### title
*italic*
**bold**
#tag
#Heading
-item
1.item
```js
#Heading
-item
const x = ';;abc;;';
```
````

## 预期输出
````text
# title
## title
### title
*italic*
**bold**
#tag
#Heading
-item
1.item
```js
#Heading
-item
const x = ';;abc;;';
```
````
