# Puzzle Race Tournament Manager

A real-time web application for managing and displaying the World Puzzle Federation Sudoku & Puzzle Grand Prix "Race to the Finish" tournament from 2025.

This system provides synchronized views for a main public display, individual judges, and tournament administrators, all powered by a central state machine that manages competitor progress in real-time.

## Features

* **Real-time Public Display:** A large, spectator-friendly screen showing the main timer and detailed progress for each competitor.
* **Mobile-First Judge's Interface:** A simple, responsive UI for judges to quickly and accurately record judgments for each puzzle.
* **Comprehensive Admin Panel:** A suite of tools for creating events, managing a master list of puzzles, building competitor rosters, and configuring specific tournaments with custom handicaps.
* **Linear Competition Design:** Specifically built for one-puzzle-at-a-time race formats that require a human judge to determine if an answer is correct.

## Tech Stack

* **Backend:** PHP 8.1+
* **Framework:** Slim 4
* **Database:** MySQL 8.0+ or MariaDB 10.6+
* **Web Server:** Apache with `mod_rewrite` enabled
* **Dependencies:** Composer

---

## Installation

To set up the application locally, follow these steps:

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/your-username/puzzle-race-tournament.git](https://github.com/your-username/puzzle-race-tournament.git)
    cd puzzle-race-tournament
    ```

2.  **Install Dependencies:**
    Use Composer to install the required PHP packages.
    ```bash
    composer install
    ```

3.  **Set Up the Database:**
    * Create a new database (e.g., `puzzle_race`) in MySQL or MariaDB.
    * Import the database schema using the provided SQL file:
        ```bash
        mysql -u your_user -p your_db_name < create_tables.sql
        ```

4.  **Configure Settings:**
    * Copy the example settings file:
        ```bash
        cp settings.php.example settings.php
        ```
    * Edit **`settings.php`** and enter your database credentials.

5.  **Configure Apache:**
    * Point the document root of your virtual host to the project's **`/public`** directory. This is critical for security and for the application's routing to work correctly.
    * Ensure `mod_rewrite` is enabled and that your server configuration allows `.htaccess` overrides.

---

## Usage

The workflow for setting up and running a tournament is as follows:

1.  **Manage Competitors:** Use the "Manage Competitors" UI to create the master roster of all possible participants.
2.  **Puzzle Manager:** Use the "Puzzle Manager" to create "Events" (e.g., "WPF GP 2025") and add all the puzzles associated with that event.
3.  **Assign Competitors to Events:** Link the competitors from your master roster to the specific event they are participating in.
4.  **Manage Tournament:** Create a new tournament instance. Here you will:
    * Select the event.
    * Choose the specific puzzles for this tournament.
    * Select the competitors from the event's roster.
    * Assign any time handicaps for each competitor.
5.  **Run the Tournament:** Once configured, you can start the tournament from the management page. Use the "Display" and "Judge" links for the live event.

## Acknowledgments
This project was developed with the assistance of Google Gemini.

---

Created by [Wei-Hwa Huang][def]

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

[def]: https://github.com/onigame/