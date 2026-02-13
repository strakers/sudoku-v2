# SUDOKU-JS

A sudoku project I built using JavaScript and math as a challenge to myself.

## Links

- [Play Version 1](https://strakez.com/projects/sudoku/)
- [Play Version 2](http://thenerdinme.com/games/sudoku/) 

## About
This project has always been a fun way for me to test my skills and push the bar in a
creative way. It also helps me learn more through practical application.


### v1
I initially built v1 using vanilla JS for fun, and so that my mom could play sudoku online. 

The goal was to build a fully functional Sudoku board that allowed a player to enter numbers into cells and have the 
board validate the inputs according to standard Sudoku rules. I catered to a 9x9 Sudoku board that could be played with 
various difficulties. 

Originally I had aimed to program the difficulties as well, however to limit the scope, I opted to use a series of field 
maps per difficulty, from which to populate the board. One map would be chosen at random for the user to play, and the 
board would be calculated accordingly.

The cells would automatically validate, though this could be toggled off by the user.


### v2

Years later, I came back to build v2 using more modern JS. The goal of this version was two-fold:

Firstly, I wanted to be able to build a full Sudoku board using only a single numerical value as input for the radius or 
edge length of the board. For example, calling `new Board(9)` would calculate a 9x9 playable Sudoku board, and calling 
calling `new Board(4)` would calculate a 4x4 one.

Secondly, I wanted to solve my original challenge in v1 by programmatically assign constants per a given difficulty. The 
user would be able to select the board size and difficulty level, and the constants would calculate and be placed in 
their designated places. This posed the biggest challenge: I needed to develop an algorithm to ensure the constants 
weren't all placed in the same sections, they needed to be dispersed across the board. However, they also needed to 
allow for a board that could be successfully completed, meaning it needed to correctly validate across all difficulties 
and board sizes.

Lastly, as a soft goal, I wanted to make it prettier and use modern JS (though still vanilla JS). React (and co.) has 
its benefits, but I didn't want this project to have any dependencies or shortcuts.
